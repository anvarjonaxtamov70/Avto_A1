package uz.avtoa1.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Telefon sozlamasidagi «Shrift o'lchami» ilova ichidagi yozuv va
        // tugmalarni kattalashtirib yubormasin — Telegram mini app bilan bir xil o'lcham.
        try {
            WebSettings ws = getBridge().getWebView().getSettings();
            ws.setTextZoom(100);
        } catch (Exception ignored) { }
    }
}
