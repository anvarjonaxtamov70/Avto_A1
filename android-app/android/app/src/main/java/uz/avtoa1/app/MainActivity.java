package uz.avtoa1.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // Sayt (index.html) dagi window.a1HandleBack(): 'handled' | 'exit' | 'none'
    private static final String BACK_JS =
        "(function(){try{return window.a1HandleBack?window.a1HandleBack():'none'}catch(e){return 'none'}})()";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Telefon sozlamasidagi «Shrift o'lchami» ilova ichidagi yozuv va
        // tugmalarni kattalashtirib yubormasin — Telegram mini app bilan bir xil o'lcham.
        try {
            WebSettings ws = getBridge().getWebView().getSettings();
            ws.setTextZoom(100);
        } catch (Exception ignored) { }

        // 🔙 Android «Orqaga» tugmasi. Capacitor o'zi faqat WebView tarixida
        //    orqaga qaytadi, bosh sahifada esa HECH NARSA qilmasdi (Google Play
        //    sifat tekshiruvida kamchilik). Endi sayt qaror qiladi: ochiq oynani
        //    yopadi, orqaga qaytadi yoki bosh sahifada ikki marta bosilsa chiqadi.
        //    Bu callback plaginlardan KEYIN qo'shiladi — shuning uchun birinchi ishlaydi.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView wv = null;
                try { wv = getBridge().getWebView(); } catch (Exception ignored) { }
                if (wv == null) { finish(); return; }
                final WebView web = wv;
                web.evaluateJavascript(BACK_JS, value -> {
                    String v = value == null ? "" : value;
                    if (v.contains("handled")) return;
                    if (v.contains("exit")) { finish(); return; }
                    // Eski sayt (funksiya yo'q) yoki xato: WebView tarixi, bo'lmasa chiqish
                    if (web.canGoBack()) web.goBack(); else finish();
                });
            }
        });
    }
}
