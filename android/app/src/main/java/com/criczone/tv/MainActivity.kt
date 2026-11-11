package com.criczone.tv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.criczone.tv.ui.CriczoneApp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = android.graphics.Color.rgb(10, 12, 16)
        window.navigationBarColor = android.graphics.Color.rgb(10, 12, 16)
        setContent { CriczoneTheme { CriczoneApp() } }
    }
}

@Composable
private fun CriczoneTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Color(0xFFFFD43B), onPrimary = Color(0xFF171717),
            background = Color(0xFF0A0C10), surface = Color(0xFF151922),
            secondary = Color(0xFFFFE58A)
        ),
        content = content
    )
}
