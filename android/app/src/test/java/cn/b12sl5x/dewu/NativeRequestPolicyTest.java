package cn.b12sl5x.dewu;
import org.junit.Test;
import static org.junit.Assert.*;
public final class NativeRequestPolicyTest {
    @Test public void rejectsOverlongCopyAndInvalidIds() {
        assertTrue(NativeRequestPolicy.canCopy(new String(new char[8192])));
        assertFalse(NativeRequestPolicy.canCopy(new String(new char[8193])));
        assertTrue(NativeRequestPolicy.validId("dewu-abc-1"));
        assertFalse(NativeRequestPolicy.validId(""));
        assertFalse(NativeRequestPolicy.validId("../escape"));
    }
    @Test public void validatesWholePngHeaderAndSize() {
        byte[] header = {(byte)137,80,78,71,13,10,26,10};
        assertTrue(NativeRequestPolicy.validPng(header));
        header[7] = 0;
        assertFalse(NativeRequestPolicy.validPng(header));
        assertFalse(NativeRequestPolicy.validPng(new byte[8 * 1024 * 1024 + 1]));
        assertFalse(NativeRequestPolicy.validPng(new byte[4]));
    }
    @Test public void filenamesCannotEscapeUserSelection() {
        assertEquals("dewu-card.png", NativeRequestPolicy.safeFilename("../../bad.png"));
        assertEquals("CARD-123.png", NativeRequestPolicy.safeFilename("CARD-123.png"));
    }
}
