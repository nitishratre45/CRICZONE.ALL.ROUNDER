package com.criczone.tv.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.criczone.tv.data.Channel
import com.criczone.tv.data.ChannelCatalog
import com.criczone.tv.data.FavoritesStore

private val Gold = Color(0xFFFFD43B)
private val Panel = Color(0xFF151922)
private val Muted = Color(0xFF9BA3B4)
private enum class Tab { HOME, SEARCH, FAVORITES, TELEGRAM }

@Composable
fun CriczoneApp() {
    val context = LocalContext.current
    val store = remember { FavoritesStore(context) }
    var favorites by remember { mutableStateOf(store.getAll()) }
    var selected by remember { mutableStateOf<Channel?>(null) }
    var tab by remember { mutableStateOf(Tab.HOME) }
    var query by remember { mutableStateOf("") }
    val channels = ChannelCatalog.demo
    val visible = channels.filter { it.name.contains(query, true) || it.category.contains(query, true) }

    if (selected != null) {
        PlayerScreen(channel = selected!!, onBack = { selected = null })
        return
    }

    Scaffold(
        containerColor = Color(0xFF0A0C10),
        bottomBar = {
            NavigationBar(containerColor = Panel, contentColor = Gold) {
                NavigationBarItem(tab == Tab.HOME, { tab = Tab.HOME }, icon = { Icon(Icons.Default.Home, null) }, label = { Text("Home") })
                NavigationBarItem(tab == Tab.SEARCH, { tab = Tab.SEARCH }, icon = { Icon(Icons.Default.Search, null) }, label = { Text("Search") })
                NavigationBarItem(tab == Tab.FAVORITES, { tab = Tab.FAVORITES }, icon = { Icon(Icons.Default.Favorite, null) }, label = { Text("Saved") })
                NavigationBarItem(tab == Tab.TELEGRAM, { tab = Tab.TELEGRAM }, icon = { Icon(Icons.Default.Send, null) }, label = { Text("Telegram") })
            }
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 18.dp)) {
            Spacer(Modifier.height(18.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("CRICZONE", color = Gold, fontSize = 25.sp, fontWeight = FontWeight.Black, letterSpacing = 1.5.sp)
                    Text("SPORTS • LIVE • ACTION", color = Muted, fontSize = 10.sp, letterSpacing = 2.sp)
                }
                Text("●", color = Gold)
            }
            Spacer(Modifier.height(22.dp))
            when (tab) {
                Tab.HOME -> {
                    HeroBanner()
                    Spacer(Modifier.height(20.dp))
                    Text("Browse channels", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(12.dp))
                    ChannelList(channels, favorites, { selected = it }, { favorites = store.toggle(it.id) })
                }
                Tab.SEARCH -> {
                    SearchField(query) { query = it }
                    Spacer(Modifier.height(14.dp))
                    ChannelList(visible, favorites, { selected = it }, { favorites = store.toggle(it.id) })
                }
                Tab.FAVORITES -> {
                    Text("Your favorites", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(12.dp))
                    ChannelList(channels.filter { it.id in favorites }, favorites, { selected = it }, { favorites = store.toggle(it.id) })
                }
                Tab.TELEGRAM -> TelegramPage()
            }
        }
    }
}

@Composable
private fun HeroBanner() {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(Panel).padding(20.dp)) {
        Text("YOUR SPORTS HUB", color = Gold, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
        Spacer(Modifier.height(8.dp))
        Text("Every match.\nOne destination.", color = Color.White, fontSize = 27.sp, fontWeight = FontWeight.ExtraBold, lineHeight = 31.sp)
        Spacer(Modifier.height(8.dp))
        Text("Find your channel and enjoy the action.", color = Muted, fontSize = 13.sp)
    }
}

@Composable
private fun SearchField(value: String, onChange: (String) -> Unit) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Panel).padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Default.Search, null, tint = Muted)
        Spacer(Modifier.width(10.dp))
        BasicTextField(value, onValueChange = onChange, singleLine = true,
            textStyle = LocalTextStyle.current.copy(color = Color.White),
            decorationBox = { inner ->
                if (value.isEmpty()) Text("Search channels or sports", color = Muted)
                inner()
            })
    }
}

@Composable
private fun ChannelList(channels: List<Channel>, favorites: Set<String>, onSelect: (Channel) -> Unit, onFavorite: (Channel) -> Unit) {
    if (channels.isEmpty()) {
        Text("No channels found yet.", color = Muted, modifier = Modifier.padding(vertical = 24.dp))
        return
    }
    LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), contentPadding = PaddingValues(bottom = 18.dp)) {
        items(channels, key = { it.id }) { channel ->
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Panel).clickable { onSelect(channel) }.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(48.dp).clip(RoundedCornerShape(12.dp)).background(Color(0xFF252B36)), contentAlignment = Alignment.Center) {
                    Text(channel.name.take(2).uppercase(), color = Gold, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.width(13.dp))
                Column(Modifier.weight(1f)) {
                    Text(channel.name, color = Color.White, fontWeight = FontWeight.SemiBold)
                    Text("${channel.category} • ${channel.language}", color = Muted, fontSize = 12.sp)
                }
                Text("LIVE", color = Color(0xFFFF6565), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                IconButton(onClick = { onFavorite(channel) }) {
                    Icon(Icons.Default.Favorite, null, tint = if (channel.id in favorites) Gold else Muted)
                }
            }
        }
    }
}

@Composable
private fun TelegramPage() {
    val context = LocalContext.current
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Panel).padding(20.dp)) {
        Text("Join the CRICZONE community", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text("Get channel updates and announcements on Telegram.", color = Muted)
        Spacer(Modifier.height(18.dp))
        Button(onClick = {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://t.me/criczonelive")))
        }, colors = ButtonDefaults.buttonColors(containerColor = Gold, contentColor = Color.Black)) {
            Icon(Icons.Default.Send, null)
            Spacer(Modifier.width(8.dp))
            Text("Open Telegram")
        }
    }
}

@Composable
private fun PlayerScreen(channel: Channel, onBack: () -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var message by remember { mutableStateOf("This channel has no authorized stream URL configured yet.") }
    val player = remember {
        ExoPlayer.Builder(context).build().apply {
            playWhenReady = true
            addListener(object : Player.Listener {
                override fun onPlayerError(error: PlaybackException) {
                    message = "Playback error: ${error.errorCodeName}"
                }
            })
            channel.streamUrl?.takeIf { it.startsWith("https://") }?.let {
                setMediaItem(MediaItem.fromUri(it))
                prepare()
            }
        }
    }
    DisposableEffect(lifecycleOwner, player) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_PAUSE -> player.pause()
                Lifecycle.Event.ON_RESUME -> if (channel.streamUrl != null) player.play()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            player.release()
        }
    }
    Column(Modifier.fillMaxSize().background(Color.Black)) {
        Row(Modifier.fillMaxWidth().background(Panel).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("‹", color = Gold, fontSize = 30.sp, modifier = Modifier.clickable { onBack() }.padding(horizontal = 10.dp))
            Column {
                Text(channel.name, color = Color.White, fontWeight = FontWeight.Bold)
                Text("CRICZONE PLAYER", color = Muted, fontSize = 10.sp, letterSpacing = 1.5.sp)
            }
        }
        Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f).background(Color.Black), contentAlignment = Alignment.Center) {
            AndroidView(factory = { viewContext -> PlayerView(viewContext).apply { useController = true; this.player = player } },
                update = { it.player = player }, modifier = Modifier.fillMaxSize())
            if (channel.streamUrl == null) Text("STREAM NOT CONFIGURED", color = Gold, fontWeight = FontWeight.Bold)
        }
        Text(message, color = Muted, modifier = Modifier.padding(18.dp))
        Text("HLS and DASH playback are supported when a valid, authorized URL is supplied.", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 18.dp))
    }
}
