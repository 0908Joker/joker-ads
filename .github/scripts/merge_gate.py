"""核验真实 CI、未解决问题与当前 SHA；所有写操作使用默认分支代码。"""
import base64
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request



class GitHub:
    def __init__(self, repository, token, default_branch, merge_token=None):
        self.repository, self.token, self.default_branch = repository, token, default_branch
        self.merge_token = merge_token
        self.ruleset_status = "未读取"

    def request(self, path, payload=None, token=None, method=None):
        data = None if payload is None else json.dumps(payload).encode()
        req = urllib.request.Request("https://api.github.com" + path, data=data, headers={
            "Authorization": "Bearer " + (token or self.token),
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
        }, method=method)
        with urllib.request.urlopen(req, timeout=20) as response:
            return json.load(response)

    def rest(self, path, payload=None):
        return self.request("/repos/" + self.repository + path, payload)

    def pages(self, path, key=None):
        result = []
        for page in range(1, 101):
            data = self.rest(path + ("&" if "?" in path else "?") + "per_page=100&page=" + str(page))
            batch = data[key] if key else data
            result.extend(batch)
            if len(batch) < 100:
                return result
        raise RuntimeError("REST 分页超限")

    def graphql(self, query, variables, token=None):
        payload = {"query": query, "variables": variables}
        response = (self.request("/graphql", payload, token=token) if token else
                    self.request("/graphql", payload))
        if response.get("errors"):
            raise RuntimeError("GraphQL 查询失败: " + str(response["errors"]))
        return response["data"]

    def pr(self, number):
        return self.rest("/pulls/" + str(number))

    def open_prs(self):
        return self.pages("/pulls?state=open")

    def checks(self, head):
        return self.pages("/commits/" + head + "/check-runs?filter=all", "check_runs")

    def statuses(self, head):
        return self.pages("/commits/" + head + "/statuses")

    def set_status(self, head, state, description):
        self.rest("/statuses/" + head, {"state": state, "context": "merge-gate",
                                      "description": description[:140]})

    def reviews(self, number):
        return self.pages("/pulls/" + str(number) + "/reviews")

    def required_checks(self, head):
        """全绿策略：当前 head 上除 merge-gate 外的每个检查运行都算必需项。
        个人仓无规则集，存在即必需；检查状态/conclusion 由调用方另行判定。"""
        checks = []
        for run in self.checks(head):
            if run["name"] == "merge-gate":
                continue
            checks.append({"context": run["name"],
                           "integration_id": (run.get("app") or {}).get("id") or 0,
                           "head_sha": run.get("head_sha")})
        self.ruleset_status = "已核对"
        return checks

    def files(self, number):
        return self.pages("/pulls/" + str(number) + "/files")

    def threads(self, number):
        owner, repo = self.repository.split("/")
        query = """query($owner:String!, $repo:String!, $number:Int!, $cursor:String) {
          repository(owner:$owner,name:$repo) { pullRequest(number:$number) {
            reviewThreads(first:100,after:$cursor) {
              nodes { id isResolved comments(first:100) {
                nodes { body } pageInfo { hasNextPage endCursor }
              } }
              pageInfo { hasNextPage endCursor }
            }
          } }
        }"""
        result, cursor = [], None
        for _ in range(100):
            data = self.graphql(query, {"owner": owner, "repo": repo,
                                       "number": number, "cursor": cursor})
            page = data["repository"]["pullRequest"]["reviewThreads"]
            for thread in page["nodes"]:
                comments = thread["comments"]
                for _ in range(100):
                    info = comments["pageInfo"]
                    if not info["hasNextPage"]:
                        break
                    more = self.graphql("""query($id:ID!, $cursor:String!) {
                      node(id:$id) { ... on PullRequestReviewThread {
                        comments(first:100,after:$cursor) {
                          nodes { body } pageInfo { hasNextPage endCursor }
                        }
                      } }
                    }""", {"id": thread["id"], "cursor": info["endCursor"]})
                    page_comments = more["node"]["comments"]
                    comments["nodes"].extend(page_comments["nodes"])
                    comments["pageInfo"] = page_comments["pageInfo"]
                else:
                    raise RuntimeError("讨论评论分页超限")
                result.append(thread)
            if not page["pageInfo"]["hasNextPage"]:
                return result
            cursor = page["pageInfo"]["endCursor"]
        raise RuntimeError("讨论分页超限")

    def enable(self, node, head):
        if not self.merge_token:
            raise RuntimeError("仓库限域合并身份不可用")
        data = self.graphql("""mutation($input:EnablePullRequestAutoMergeInput!) {
          enablePullRequestAutoMerge(input:$input) { pullRequest { id number } }
        }""", {"input": {"pullRequestId": node, "expectedHeadOid": head,
                         "mergeMethod": "SQUASH"}}, token=self.merge_token)
        payload = data.get("enablePullRequestAutoMerge") if isinstance(data, dict) else None
        if (not isinstance(payload, dict) or payload.get("userErrors") or
                not isinstance(payload.get("pullRequest"), dict) or
                payload["pullRequest"].get("id") != node or
                type(payload["pullRequest"].get("number")) is not int):
            raise RuntimeError("开启自动合并未确认成功")

    def update_branch(self, number, head):
        self.request("/repos/" + self.repository + "/pulls/" + str(number) + "/update-branch",
                     {"expected_head_sha": head}, method="PUT")

    def merge(self, number, head):
        """条件已全部满足的 PR，GitHub 拒绝登记自动合并（clean/unstable 状态报错），
        改由仅限本仓的合并身份绑定 head sha 直接压缩合并；非该身份或未确认合并即失败。"""
        if not self.merge_token:
            raise RuntimeError("仓库限域合并身份不可用")
        data = self.request("/repos/" + self.repository + "/pulls/" + str(number) + "/merge",
                            {"sha": head, "merge_method": "squash"},
                            token=self.merge_token, method="PUT")
        if not isinstance(data, dict) or data.get("merged") is not True:
            raise RuntimeError("直接合并未确认成功")

    def disable(self, node):
        self.graphql("""mutation($input:DisablePullRequestAutoMergeInput!) {
          disablePullRequestAutoMerge(input:$input) { pullRequest { number } }
        }""", {"input": {"pullRequestId": node}})

    def label_error(self, number):
        self.rest("/issues/" + str(number) + "/labels", {"labels": ["gate-error"]})

    def comment_error(self, number):
        self.rest("/issues/" + str(number) + "/comments",
                  {"body": "合并门无法确认自动合并已撤销；请检查权限、登记状态和门禁结果。"})


# clean = 必需检查全过且无阻挡；unstable = 必需检查全过但有非必需状态失败（如门禁上一轮写的 failure）。
# 两者 GitHub 都拒绝 enablePullRequestAutoMerge，只能直接合并；blocked/behind/dirty/unknown 仍走登记。
DIRECT_MERGE_STATES = frozenset({"clean", "unstable"})


class HeadChanged(Exception):
    pass


class BaseChanged(Exception):
    pass


def latest_by_id(items, key):
    latest = {}
    for item in items:
        ident = item.get("id")
        if type(ident) is not int or ident <= 0:
            raise RuntimeError("检查或状态缺少可排序 ID")
        group = key(item)
        if group not in latest or ident > latest[group]["id"]:
            latest[group] = item
    return list(latest.values())


def current_head(api, number, head, *, allow_other_base=False):
    current = api.pr(number)
    if current["head"]["sha"] != head:
        raise HeadChanged("当前 head 已变化，停止本次写回")
    if not allow_other_base and current["base"]["ref"] != api.default_branch:
        raise BaseChanged("目标分支已变化，停止本次写回")
    return current


def guarded_status(api, number, head, state, description):
    current_head(api, number, head)
    statuses = latest_by_id(api.statuses(head), lambda item: item["context"])
    existing = next((item for item in statuses if item["context"] == "merge-gate"), None)
    creator = (existing or {}).get("creator") or {}
    if (existing and existing["state"] == state and
            creator.get("login") == "github-actions[bot]" and creator.get("type") == "Bot"):
        return
    current_head(api, number, head)
    api.set_status(head, state, description)


def start_pending(api, number, head):
    current_head(api, number, head)
    statuses = latest_by_id(api.statuses(head), lambda item: item["context"])
    existing = next((item for item in statuses if item["context"] == "merge-gate"), None)
    creator = (existing or {}).get("creator") or {}
    if (existing and existing["state"] in ("failure", "error") and
            creator.get("login") == "github-actions[bot]" and creator.get("type") == "Bot"):
        return
    guarded_status(api, number, head, "pending", "合并门正在判定")


def ensure_revoked(api, number, head, node, *, allow_other_base=False):
    """最多三次撤销并读回；无法确认时尝试标记和说明。"""
    errors = []
    for _ in range(3):
        try:
            current = current_head(api, number, head, allow_other_base=allow_other_base)
            if current.get("auto_merge") is None:
                return True, "没有已登记自动合并或已确认撤销"
            current_head(api, number, head, allow_other_base=allow_other_base)
            api.disable(node)
            if current_head(api, number, head, allow_other_base=allow_other_base).get("auto_merge") is None:
                return True, "已撤销并回读确认"
        except HeadChanged:
            raise
        except Exception as exc:
            errors.append(safe_error(exc))
            continue
    fallback_failed = False
    for method in (api.label_error, api.comment_error):
        try:
            current_head(api, number, head, allow_other_base=allow_other_base)
            method(number)
        except HeadChanged:
            raise
        except Exception as exc:
            fallback_failed = True
            errors.append(safe_error(exc))
    suffix = "；标记或说明失败" if fallback_failed else "；已尝试标记和说明"
    codes = "；原因=" + ",".join(sorted(set(errors))) if errors else ""
    return False, "三次未能确认自动合并撤销" + suffix + codes


def stop_outside_base(api, number, rows):
    """离开受管分支时只撤销登记，不为其他分支写通过状态。"""
    for _ in range(3):
        try:
            current = api.pr(number)
            confirmed, reason = ensure_revoked(api, number, current["head"]["sha"],
                current["node_id"], allow_other_base=True)
            rows["head 绑定"] = ("等待", "base_changed：目标分支已离开本门禁范围")
            rows["自动合并撤销"] = ("通过" if confirmed else "失败", reason)
            return (0 if confirmed else 1), rows
        except HeadChanged:
            continue
        except Exception as exc:
            rows["自动合并撤销"] = ("失败", "离开目标分支后撤销未确认: " + safe_error(exc))
            return 1, rows
    rows["自动合并撤销"] = ("失败", "head 持续变化，撤销未确认")
    return 1, rows


def evidence_snapshot(pr, runs, statuses, files, reviews, threads, required):
    """开启前再次读取同一组真实证据；发生变化时拒绝沿用旧判定。"""
    base = {"ref": pr["base"]["ref"], "sha": pr["base"].get("sha")}
    view = {"head": pr["head"]["sha"], "base": base, "draft": pr["draft"],
            "state": pr.get("state"), "labels": pr["labels"],
            "auto_merge": pr.get("auto_merge"), "checks": runs,
            "statuses": statuses, "files": files, "reviews": reviews,
            "threads": threads, "required": required}
    return json.dumps(view, sort_keys=True, ensure_ascii=False)


def recover_head_change(api, number, switch, rows, attempts):
    if attempts >= 3:
        rows["head 绑定"] = ("失败", "head 多次变化，撤销与重判未完成")
        return 1, rows
    try:
        latest = api.pr(number)
        if latest["base"]["ref"] != api.default_branch:
            return stop_outside_base(api, number, rows)
        latest_head = latest["head"]["sha"]
        confirmed, reason = ensure_revoked(api, number, latest_head, latest["node_id"])
        if not confirmed:
            rows["自动合并撤销"] = ("失败", reason)
            guarded_status(api, number, latest_head, "failure", "合并门撤销未确认")
            return 1, rows
        return evaluate(api, number, switch, attempts + 1)
    except HeadChanged:
        return recover_head_change(api, number, switch, rows, attempts + 1)
    except Exception as exc:
        rows["自动合并撤销"] = ("失败", "head 变化后撤销或重判未确认: " + safe_error(exc))
        return 1, rows


def ci_checks(runs, required):
    """已知可选 AI 审查进度只作参考；登记为必需的检查仍按真实来源验证。"""
    required_names = {item["context"] for item in required}
    return [run for run in runs if run["name"] != "copilot-pull-request-reviewer" or run["name"] in required_names]


def evaluate(api, number, switch, attempts=0):
    names = ("CI", "审查问题", "P0P1 讨论", "head 绑定", "自动合并撤销")
    rows = {name: ("等待", "尚未判定") for name in names}
    try:
        pr = api.pr(number)
        head = pr["head"]["sha"]
    except Exception as exc:
        rows["head 绑定"] = ("失败", "无法读取 head，未写状态: " + safe_error(exc))
        rows["自动合并撤销"] = ("失败", "无法读取 PR，撤销未确认")
        return 1, rows
    if pr["base"]["ref"] != api.default_branch:
        return stop_outside_base(api, number, rows)
    if pr.get("state", "open") != "open":
        return 0, {name: ("等待", "非默认分支或非开放 PR，跳过") for name in names}
    if pr["draft"]:
        if pr.get("auto_merge") is not None:
            try:
                confirmed, reason = ensure_revoked(api, number, head, pr["node_id"])
                if not confirmed:
                    rows["自动合并撤销"] = ("失败", reason)
                    return 1, rows
            except HeadChanged:
                return recover_head_change(api, number, switch, rows, attempts)
            except Exception as exc:
                rows["自动合并撤销"] = ("失败", "草稿自动合并撤销未确认: " + safe_error(exc))
                return 1, rows
        return 0, {name: ("等待", "草稿 PR，跳过") for name in names}
    if any(label["name"] == "needs-rehearsal" for label in pr["labels"]):
        try:
            confirmed, reason = ensure_revoked(api, number, head, pr["node_id"])
            rows["自动合并撤销"] = ("通过" if confirmed else "失败", reason)
            rows["head 绑定"] = ("等待", "候选尚需排练")
            guarded_status(api, number, head, "pending", "候选尚需排练")
        except HeadChanged:
            return recover_head_change(api, number, switch, rows, attempts)
        return 1, rows
    outcome = "failure"
    try:
        start_pending(api, number, head)
        runs = latest_by_id([c for c in api.checks(head) if c["name"] != "merge-gate"],
                            lambda item: (item["name"], (item.get("app") or {}).get("id")))
        statuses = latest_by_id([s for s in api.statuses(head) if s["context"] != "merge-gate"],
                                lambda item: item["context"])
        try:
            required_checks = api.required_checks(head)
            if api.ruleset_status != "已核对":
                raise RuntimeError("检查清单核验不完整")
        except Exception:
            rows["CI"] = ("失败", "检查清单读取失败；规则集" + api.ruleset_status)
            raise
        # 全绿策略：零检查不判失败，由下方 pending 判定保持等待。
        failed = any(c["status"] == "completed" and c["conclusion"] not in
                     ("success", "skipped", "neutral") for c in runs)
        failed |= any(s["state"] in ("failure", "error") for s in statuses)
        pending = (not runs and not statuses or
                   any(c["status"] != "completed" for c in runs) or
                   any(s["state"] == "pending" for s in statuses))
        check_reasons = []
        if pending and not runs and not statuses and                 os.getenv("PM_MERGE_ALLOW_NO_CHECKS") == "true":
            pending = False
            check_reasons.append("no_checks_waived")
        for item in required_checks:
            matches = [c for c in runs if c["name"] == item["context"] and
                       (c.get("app") or {}).get("id") == item["integration_id"]]
            if not matches:
                check_reasons.append("check_missing_or_source_mismatch")
                failed = True
            elif item.get("head_sha") and item["head_sha"] != head:
                check_reasons.append("check_stale")
                failed = True
            elif any(c["status"] != "completed" for c in matches):
                pending = True
            elif any(c["conclusion"] != "success" for c in matches):
                failed = True
        rows["CI"] = (("失败", "存在失败检查") if failed else
                      ("等待", "检查未完成或尚无检查") if pending else
                      ("通过", "当前 head 检查通过"))
        rows["CI"] = (rows["CI"][0], rows["CI"][1] + "；全绿策略")
        if check_reasons:
            rows["CI"] = (rows["CI"][0], rows["CI"][1] + "；" + ",".join(sorted(set(check_reasons))))
        files = api.files(number)
        if pr.get("changed_files") is not None and len(files) < pr["changed_files"]:
            raise RuntimeError("PR 文件列表不完整，不能安全判定")
        reviews = api.reviews(number)
        threads = api.threads(number)
        before = evidence_snapshot(pr, runs, statuses, files, reviews, threads, required_checks)
        requested_reviews = {}
        for review in reviews:
            actor = (review.get("user") or {}).get("login")
            if actor and review.get("state") == "CHANGES_REQUESTED":
                requested_reviews[actor] = review
            elif actor and review.get("state") in {"APPROVED", "DISMISSED"}:
                requested_reviews.pop(actor, None)
        requested = list(requested_reviews.values())
        rows["审查问题"] = (("失败", f"有 {len(requested)} 份未解除的请求修改") if requested
                            else ("通过", "无未解除的请求修改；不要求厂商票据"))
        blockers = []
        for thread in threads:
            if thread["isResolved"]:
                continue
            nodes = thread["comments"]["nodes"]
            body = nodes[0]["body"] if nodes else ""
            later_block = any(re.match(r"^\[P[01]\]", item["body"]) for item in nodes[1:])
            if not body.startswith("[P2]") or later_block:
                blockers.append(thread)
        rows["P0P1 讨论"] = (("失败", f"有 {len(blockers)} 条未解决阻挡讨论") if blockers
                            else ("通过", "无未解决阻挡讨论"))
        states = [rows[n][0] for n in ("CI", "审查问题", "P0P1 讨论")]
        if "失败" in states:
            outcome = "failure"
        elif "等待" in states:
            outcome = "pending"
        else:
            outcome = "success"
        if outcome == "success" and switch == "true":
            current = current_head(api, number, head)
            current_runs = latest_by_id([c for c in api.checks(head) if c["name"] != "merge-gate"],
                                        lambda item: (item["name"], (item.get("app") or {}).get("id")))
            current_statuses = latest_by_id([s for s in api.statuses(head) if s["context"] != "merge-gate"],
                                            lambda item: item["context"])
            current_required = api.required_checks(head)
            if api.ruleset_status != "已核对":
                rows["CI"] = (rows["CI"][0], rows["CI"][1] +
                              "；开启前规则集" + api.ruleset_status)
            after = evidence_snapshot(current, current_runs, current_statuses,
                                      api.files(number), api.reviews(number), api.threads(number),
                                      current_required)
            if before != after:
                outcome = "failure"
                rows["head 绑定"] = ("失败", "开启前判定证据已变化")
            else:
                current = current_head(api, number, head)
                if (current.get("auto_merge") is None
                        and current.get("mergeable_state") == "behind"):
                    try:
                        api.update_branch(number, head)
                        rows["head 绑定"] = ("等待", "落后基线，已触发更新分支，下轮判定")
                    except Exception:
                        rows["head 绑定"] = ("等待", "落后基线且自动更新被拒，需修复方处理")
                elif current.get("auto_merge") is None and current.get("mergeable_state") in DIRECT_MERGE_STATES:
                    # 必需检查已全部通过时 GitHub 不接受自动合并登记，复核证据后绑定 sha 直接合并。
                    api.merge(number, head)
                    if current_head(api, number, head).get("merged") is not True:
                        raise RuntimeError("直接合并后未确认已合并")
                    rows["head 绑定"] = ("通过", "条件已全部满足，复核证据后绑定 sha 由合并身份直接合并")
                elif current.get("auto_merge") is None:
                    try:
                        api.enable(pr["node_id"], head)
                        if current_head(api, number, head).get("auto_merge") is None:
                            raise RuntimeError("开启后未确认自动合并登记")
                        rows["head 绑定"] = ("通过", "复核证据后使用 expectedHeadOid 登记")
                    except Exception:
                        # 仓级关闭自动合并功能时登记不可用；改绑 head sha 直接合并，
                        # 由 GitHub 服务端权威拒绝真正不可合状态。
                        api.merge(number, head)
                        if current_head(api, number, head).get("merged") is not True:
                            raise RuntimeError("直接合并未确认成功")
                        rows["head 绑定"] = ("通过", "自动合并登记不可用，复核证据后绑 sha 直接合并")
                else:
                    rows["head 绑定"] = ("通过", "当前 head 已登记自动合并")
                rows["自动合并撤销"] = ("通过", "条件满足，无需撤销")
        else:
            rows["head 绑定"] = ("等待", "条件或开关未满足")
    except HeadChanged as exc:
        rows["head 绑定"] = ("失败", safe_error(exc))
        return recover_head_change(api, number, switch, rows, attempts)
    except BaseChanged as exc:
        rows["head 绑定"] = ("失败", safe_error(exc))
        return stop_outside_base(api, number, rows)
    except Exception as exc:
        outcome = "failure"
        rows["head 绑定"] = ("失败", "判定异常: " + safe_error(exc))
    try:
        if outcome != "success" or switch != "true":
            confirmed, reason = ensure_revoked(api, number, head, pr["node_id"])
            rows["自动合并撤销"] = ("通过" if confirmed else "失败", reason)
            if not confirmed:
                outcome = "failure"
        guarded_status(api, number, head, outcome,
                       "合并门通过" if outcome == "success" else
                       "合并门等待" if outcome == "pending" else "合并门失败")
        if outcome == "success" and switch != "true":
            # guarded_status 已重新核对当前 head；关闭开关只影响自动合并登记。
            rows["head 绑定"] = ("通过", "当前 head 已复核；自动合并关闭")
    except HeadChanged as exc:
        rows["head 绑定"] = ("失败", safe_error(exc))
        return recover_head_change(api, number, switch, rows, attempts)
    except BaseChanged as exc:
        rows["head 绑定"] = ("失败", safe_error(exc))
        return stop_outside_base(api, number, rows)
    except Exception as exc:
        rows["head 绑定"] = ("失败", "写回失败: " + safe_error(exc))
        outcome = "failure"
        try:
            confirmed, reason = ensure_revoked(api, number, head, pr["node_id"])
            rows["自动合并撤销"] = ("通过" if confirmed else "失败", reason)
            guarded_status(api, number, head, "failure", "合并门写回失败")
        except HeadChanged as changed:
            rows["head 绑定"] = ("失败", safe_error(changed))
            return recover_head_change(api, number, switch, rows, attempts)
        except BaseChanged as changed:
            rows["head 绑定"] = ("失败", safe_error(changed))
            return stop_outside_base(api, number, rows)
        except Exception as failure:
            rows["自动合并撤销"] = ("失败", "无法确认撤销或写入失败状态: " + safe_error(failure))
    return (0 if outcome == "success" else 1), rows


def safe_error(error):
    """异常只输出固定分类，不回显 API 响应、令牌或业务内容。"""
    message = str(error).lower()
    status = getattr(error, "code", None)
    if status == 403 or "resource not accessible" in message or "forbidden" in message:
        return "permission_denied"
    if status == 401 or "bad credentials" in message:
        return "credential_rejected"
    if "仓库限域合并身份不可用" in message:
        return "merge_token_missing"
    if isinstance(error, HeadChanged):
        return "head_changed"
    if isinstance(error, BaseChanged):
        return "base_changed"
    if "规则集" in message or "必需检查清单" in message or "独立验证的必需检查" in message:
        return "ruleset_unverified"
    return "api_or_evidence_error"


def diagnostic(rows):
    """候选正常阻挡与自动化异常分开记录，保留原门禁退出结果。"""
    reasons = set()
    enabled = os.getenv("PM_AUTO_MERGE_ENABLED") == "true"
    if not enabled:
        reasons.add("auto_merge_disabled")
    if enabled and os.getenv("MERGE_TOKEN_MINT_OUTCOME") == "failure":
        reasons.add("token_mint_failed")
    if enabled and os.getenv("MERGE_TOKEN_SOURCE") == "missing" and not os.getenv("MERGE_TOKEN"):
        reasons.add("merge_token_missing")
    for name, (state, reason) in rows.items():
        if state == "通过":
            continue
        for code in ("permission_denied", "credential_rejected", "merge_token_missing",
                     "ruleset_unverified", "api_or_evidence_error", "head_changed", "base_changed",
                     "check_missing_or_source_mismatch", "check_stale"):
            if code in reason:
                reasons.add(code)
        if name == "CI":
            reasons.add("checks_failed" if state == "失败" else "checks_pending")
        elif name == "P0P1 讨论" and state == "失败":
            reasons.add("unresolved_discussion")
        elif name == "审查问题" and state == "失败":
            reasons.add("changes_requested")
        elif name == "自动合并撤销" and state == "失败":
            reasons.add("revocation_unconfirmed")
        elif name == "head 绑定" and "变化" in reason:
            reasons.add("evidence_changed")
    faults = {"permission_denied", "credential_rejected", "merge_token_missing", "ruleset_unverified",
              "api_or_evidence_error", "revocation_unconfirmed", "token_mint_failed"}
    checks_passed = all(rows.get(name, ("等待", ""))[0] == "通过"
                        for name in ("CI", "审查问题", "P0P1 讨论"))
    if reasons & faults:
        outcome = "automation_error"
    elif checks_passed and "base_changed" not in reasons and rows.get("head 绑定", ("等待", ""))[0] == "通过":
        outcome = "eligible" if enabled else "eligible_auto_merge_disabled"
    else:
        outcome = "candidate_blocked"
    source = os.getenv("MERGE_TOKEN_SOURCE", "unknown")
    mint = os.getenv("MERGE_TOKEN_MINT_OUTCOME", "unknown")
    return {"outcome": outcome, "reason_codes": sorted(reasons), "auto_merge_enabled": enabled,
            "merge_token_present": bool(os.getenv("MERGE_TOKEN")),
            "token_source": source if source in {"actions", "missing"} else "unknown",
            "token_mint_outcome": mint if mint in {"success", "failure", "skipped"} else "unknown"}


def summary(number, rows):
    lines = [f"### PR #{number}", "| 检查 | 状态 | 原因 |", "| --- | --- | --- |"]
    lines += [f"| {name} | {state} | {reason} |" for name, (state, reason) in rows.items()]
    print(json.dumps({"pr": number, "checks": rows, "diagnostic": diagnostic(rows)}, ensure_ascii=False), flush=True)
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as out:
        out.write("\n".join(lines) + "\n")


CANDIDATE_LABELS = frozenset({"pm:managed", "auto-merge"})
CANDIDATE_LABEL_PREFIXES = ("pm:gate-ready:",)
CANDIDATE_BRANCH_PREFIXES = ("devin/", "auditfix/")


def is_candidate(pr):
    """参评候选：流水线在跟进的 PR——pm:managed/auto-merge/pm:gate-ready:* 标签、
    已武装自动合并（armed 永远参评以保留撤销职责），或 devin/auditfix 修复分支。
    存量 PR 不参评，避免积压老 PR 把门拖成常红。"""
    labels = {str(label.get("name", "")) for label in pr.get("labels") or []}
    if labels & CANDIDATE_LABELS or any(
            name.startswith(CANDIDATE_LABEL_PREFIXES) for name in labels):
        return True
    if pr.get("auto_merge") is not None:
        return True
    return str((pr.get("head") or {}).get("ref") or "").startswith(
        CANDIDATE_BRANCH_PREFIXES)


def blocked_only(rows):
    """批量巡检下只把确实判定完的阻挡视为正常；head 绑定或撤销失败都按故障保留红灯。"""
    return (diagnostic(rows)["outcome"] != "automation_error"
            and all(rows.get(name, ("", ""))[0] != "失败" for name in ("head 绑定", "自动合并撤销")))


def main():
    with open(os.environ["GITHUB_EVENT_PATH"], encoding="utf-8") as inp:
        event = json.load(inp)
    api = GitHub(os.environ["GITHUB_REPOSITORY"], os.environ["GH_TOKEN"],
                 event["repository"]["default_branch"], os.getenv("MERGE_TOKEN"))
    if event.get("pull_request"):
        numbers = ([event["pull_request"]["number"]]
                   if is_candidate(event["pull_request"]) else [])
    elif event.get("issue"):
        if not event["issue"].get("pull_request"):
            numbers = []
        else:
            try:
                numbers = ([event["issue"]["number"]]
                           if is_candidate(api.pr(event["issue"]["number"]))
                           else [])
            except Exception:
                numbers = [event["issue"]["number"]]  # 拉取失败仍判定，保留撤销职责
    elif event.get("inputs", {}).get("pr_number"):
        numbers = [int(event["inputs"]["pr_number"])]  # 显式指定 PR 始终判定
    else:
        numbers = [p["number"] for p in api.open_prs()
                   if not p["draft"] and p["base"]["ref"] == api.default_branch
                   and is_candidate(p)]
    if not numbers:
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as out:
            print("无参评候选 PR（候选=pm:managed/auto-merge/pm:gate-ready 标记、"
                  "已武装自动合并、devin/auditfix 分支）。", file=out)
    sweep = not (event.get("pull_request") or event.get("issue")
                 or event.get("inputs", {}).get("pr_number"))
    code = 0
    for number in numbers:
        result, rows = evaluate(api, number, os.getenv("PM_AUTO_MERGE_ENABLED", ""))
        summary(number, rows)
        # 批量巡检：候选 PR 被挡是常态，结论已写入 PR 状态；只有自动化故障才让任务变红。
        if sweep and blocked_only(rows):
            result = 0
        code = max(code, result)
    return code


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"合并门无法判定: {safe_error(exc)}", file=sys.stderr)
        sys.exit(1)
