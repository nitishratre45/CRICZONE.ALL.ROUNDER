package com.criczone.matches

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var root: FrameLayout
    private var fullscreenView: View? = null
    private var fullscreenCallback: WebChromeClient.CustomViewCallback? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(7, 9, 14)
        window.navigationBarColor = Color.BLACK
        root = FrameLayout(this)
        webView = WebView(this)
        root.addView(webView, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        setContentView(root)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            loadsImagesAutomatically = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            allowFileAccess = false
            allowContentAccess = false
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            userAgentString = "$userAgentString CRICZONE-Matches-Android/1.0"
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                return when (uri.scheme?.lowercase()) {
                    "http", "https" -> false
                    else -> { try { startActivity(Intent(Intent.ACTION_VIEW, uri)) } catch (_: Exception) {}; true }
                }
            }
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                if (url?.startsWith("https://criczone.pages.dev/matches") == true) view?.evaluateJavascript(APP_POLISH_CSS, null)
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                if (fullscreenView != null) { callback?.onCustomViewHidden(); return }
                fullscreenView = view; fullscreenCallback = callback
                webView.visibility = View.GONE
                if (view != null) root.addView(view, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
                window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            }
            override fun onHideCustomView() { exitFullscreen() }
        }
        if (savedInstanceState == null) webView.loadUrl(BuildConfig.WEB_APP_URL) else webView.restoreState(savedInstanceState)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (fullscreenView != null) exitFullscreen() else if (webView.canGoBack()) webView.goBack() else finish()
            }
        })
    }

    private fun exitFullscreen() {
        fullscreenView?.let { root.removeView(it) }
        fullscreenView = null
        fullscreenCallback?.onCustomViewHidden()
        fullscreenCallback = null
        webView.visibility = View.VISIBLE
        window.decorView.systemUiVisibility = 0
    }
    override fun onSaveInstanceState(outState: Bundle) { webView.saveState(outState); super.onSaveInstanceState(outState) }
    override fun onDestroy() { webView.stopLoading(); webView.destroy(); super.onDestroy() }

    companion object {
        private const val APP_POLISH_CSS = """
            (function(){
              if(document.getElementById('criczone-matches-app-polish')) return;
              var s=document.createElement('style'); s.id='criczone-matches-app-polish';
              s.textContent="html,body{min-height:100%;overscroll-behavior-y:contain;-webkit-font-smoothing:antialiased}body{padding-bottom:env(safe-area-inset-bottom)!important}header{padding-left:18px!important;padding-right:18px!important}main{padding-left:16px!important;padding-right:16px!important;gap:30px!important}button,a,[role=button]{-webkit-tap-highlight-color:transparent;touch-action:manipulation}img,video,iframe{max-width:100%}.section-hd{align-items:center;gap:12px}.section-title{line-height:1.25;letter-spacing:-.035em}.stream-section,.match-card,.channel-card,.watch-card{scroll-margin-top:86px}input,select,textarea{font-size:16px!important}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-thumb{background:rgba(56,189,248,.35);border-radius:99px}@media(max-width:600px){header{height:64px!important}.mobile-menu{top:64px!important;max-height:calc(100dvh - 64px)!important}main{padding-top:24px!important;gap:26px!important}.section-hd{margin-bottom:15px!important}.section-title{font-size:1.22rem!important}.header-nav a,.mobile-menu a{min-height:44px}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;transition-duration:.01ms!important}}";
              document.head.appendChild(s);
            })();
        """
    }
}
