package com.criczone.tv.ui

import android.app.Activity
import android.content.pm.ActivityInfo
import android.graphics.Color as AndroidColor
import android.net.Uri
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.viewinterop.AndroidView
import com.criczone.tv.data.Channel

private val PlayerGold = Color(0xFFFFD43B)
private val PlayerPanel = Color(0xFF151922)
private val PlayerMuted = Color(0xFF9BA3B4)

/**
 * Hosts the CRICZONE web player inside Android WebView.
 * The configured player page may itself embed the provider's iframe.
 * Only HTTPS player URLs should be supplied by the trusted app API.
 */
@Composable
fun IframePlayerScreen(channel: Channel, onBack: () -> Unit) {
    val context = LocalContext.current
    val activity = context as? Activity
    var error by remember { mutableStateOf<String?>(null) }
    var webViewRef by remember { mutableStateOf<WebView?>(null) }

    BackHandler(enabled = true) {
        val webView = webViewRef
        if (webView?.canGoBack() == true) webView.goBack() else onBack()
    }

    DisposableEffect(Unit) {
        onDispose {
            webViewRef?.apply {
                stopLoading()
                loadUrl("about:blank")
                clearHistory()
                removeAllViews()
                destroy()
            }
            webViewRef = null
        }
    }

    Column(Modifier.fillMaxSize().background(Color.Black)) {
        Row(
            Modifier.fillMaxWidth().background(PlayerPanel).padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("‹", color = PlayerGold, fontSize = 30.sp,
                modifier = Modifier.clickable { onBack() }.padding(horizontal = 10.dp))
            Column {
                Text(channel.name, color = Color.White, fontWeight = FontWeight.Bold)
                Text("CRICZONE • EMBEDDED PLAYER", color = PlayerMuted, fontSize = 10.sp, letterSpacing = 1.sp)
            }
        }

        Box(
            Modifier.fillMaxWidth().aspectRatio(16f / 9f).background(AndroidColor.BLACK.let { Color.Black }),
            contentAlignment = Alignment.Center
        ) {
            if (channel.playerPageUrl.isNullOrBlank() || !channel.playerPageUrl.startsWith("https://") || Uri.parse(channel.playerPageUrl).host !in setOf("criczone.pages.dev", "criczoneall.vercel.app")) {
                Column(
                    Modifier.fillMaxWidth().padding(24.dp).clip(RoundedCornerShape(16.dp))
                        .background(PlayerPanel).padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("PLAYER URL NOT CONFIGURED", color = PlayerGold, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(8.dp))
                    Text("Add an authorized HTTPS player page in the CRICZONE Admin Panel.", color = PlayerMuted, fontSize = 12.sp)
                }
            } else {
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { viewContext ->
                        WebView(viewContext).apply {
                            setBackgroundColor(AndroidColor.BLACK)
                            settings.javaScriptEnabled = true
                            settings.domStorageEnabled = true
                            settings.loadsImagesAutomatically = true
                            settings.mediaPlaybackRequiresUserGesture = false
                            settings.javaScriptCanOpenWindowsAutomatically = false
                            settings.setSupportMultipleWindows(false)
                            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                            settings.cacheMode = WebSettings.LOAD_DEFAULT
                            CookieManager.getInstance().setAcceptCookie(true)
                            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)

                            webViewClient = object : WebViewClient() {
                                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                                    // Keep HTTPS player navigation inside the app; reject insecure schemes.
                                    return request.url.scheme != "https"
                                }
                                override fun onReceivedError(
                                    view: WebView,
                                    request: WebResourceRequest,
                                    webError: android.webkit.WebResourceError
                                ) {
                                    if (request.isForMainFrame) error = "Player page could not load: ${webError.description}"
                                }
                            }

                            webChromeClient = object : WebChromeClient() {
                                private var fullscreenView: View? = null
                                private var fullscreenCallback: CustomViewCallback? = null
                                private var previousOrientation: Int = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                                private var previousSystemUi: Int = 0

                                override fun onShowCustomView(view: View, callback: CustomViewCallback) {
                                    if (fullscreenView != null) {
                                        callback.onCustomViewHidden()
                                        return
                                    }
                                    fullscreenView = view
                                    fullscreenCallback = callback
                                    activity?.let { host ->
                                        previousOrientation = host.requestedOrientation
                                        previousSystemUi = host.window.decorView.systemUiVisibility
                                        host.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                                        val decor = host.window.decorView as ViewGroup
                                        decor.addView(view, FrameLayout.LayoutParams(
                                            ViewGroup.LayoutParams.MATCH_PARENT,
                                            ViewGroup.LayoutParams.MATCH_PARENT
                                        ))
                                        decor.systemUiVisibility = (View.SYSTEM_UI_FLAG_FULLSCREEN
                                            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                                            or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                                            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                                            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION)
                                    }
                                }

                                override fun onHideCustomView() {
                                    val host = activity
                                    val view = fullscreenView
                                    if (host != null && view != null) {
                                        (host.window.decorView as ViewGroup).removeView(view)
                                        host.requestedOrientation = previousOrientation
                                        host.window.decorView.systemUiVisibility = previousSystemUi
                                    }
                                    fullscreenView = null
                                    fullscreenCallback?.onCustomViewHidden()
                                    fullscreenCallback = null
                                }
                            }

                            // links.json already points to the CRICZONE player page.
                            // Load it as the WebView document so its own player iframe is not double-wrapped.
                            val safeUrl = channel.playerPageUrl
                            loadUrl(safeUrl)
                            webViewRef = this
                        }
                    },
                    update = { webViewRef = it }
                )
            }
        }

        error?.let {
            Text(it, color = Color(0xFFFF7777), fontSize = 12.sp, modifier = Modifier.padding(14.dp))
        }
        Text(
            "Embedded web player • HTTPS only",
            color = PlayerMuted,
            fontSize = 11.sp,
            modifier = Modifier.padding(14.dp)
        )
    }
}
