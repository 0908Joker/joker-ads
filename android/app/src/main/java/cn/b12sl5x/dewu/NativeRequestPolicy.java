package cn.b12sl5x.dewu;

final class NativeRequestPolicy {
    private NativeRequestPolicy() {}
    static boolean validId(String id) { return id != null && id.matches("[A-Za-z0-9_-]{1,96}"); }
    static boolean canCopy(String text) { return text != null && text.length() <= 8192; }
    static boolean validPng(byte[] data) {
        int[] signature = {137, 80, 78, 71, 13, 10, 26, 10};
        if (data == null || data.length < signature.length || data.length > 8 * 1024 * 1024) return false;
        for (int i = 0; i < signature.length; i++) if ((data[i] & 255) != signature[i]) return false;
        return true;
    }
    static String safeFilename(String name) {
        return name != null && name.matches("[A-Za-z0-9_-]{1,80}\\.png") ? name : "dewu-card.png";
    }
}
