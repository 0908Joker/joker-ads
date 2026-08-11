import { apiFetch } from './client.js'

export async function fetchNavList(code = 'Tcab') {
  return apiFetch(`/navs/list?code=${code}`)
}

export async function fetchAppModule() {
  return apiFetch('/app/module?fields=16,20,25,26,28,33,35,36,37,38,40,42,43,50,51,52,55,59,56&code=Tcab')
}
