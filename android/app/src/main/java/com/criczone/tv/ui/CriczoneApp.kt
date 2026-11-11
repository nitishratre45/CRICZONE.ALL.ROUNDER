package com.criczone.tv.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
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
import coil.compose.AsyncImage
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
    var selectedCategory by remember { mutableStateOf("All") }
    val channels = remember(context) { ChannelCatalog.load(context) }
    val categories = remember(channels) { listOf("All") + channels.map { it.category }.distinct().sorted() }
    val homeChannels = if (selectedCategory == "All") channels else channels.filter { it.category == selectedCategory }
    val visible = channels.filter { it.name.contains(query, true) || it.category.contains(query, true) }

    if (selected != null) {
        IframePlayerScreen(channel = selected!!, onBack = { selected = null })
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
                    CategorySelector(categories, selectedCategory) { selectedCategory = it }
                    Spacer(Modifier.height(12.dp))
                    ChannelList(homeChannels, favorites, { selected = it }, { favorites = store.toggle(it.id) })
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
private fun CategorySelector(categories: List<String>, selected: String, onSelect: (String) -> Unit) {
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        categories.forEach { category ->
            FilterChip(
                selected = selected == category,
                onClick = { onSelect(category) },
                label = { Text(category.substringBefore(" |").take(22), maxLines = 1) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = Gold,
                    selectedLabelColor = Color.Black,
                    labelColor = Muted
                )
            )
        }
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
        Text("Channel catalogue could not be loaded. Please retry after updating the app.", color = Muted, modifier = Modifier.padding(vertical = 24.dp))
        return
    }
    LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), contentPadding = PaddingValues(bottom = 18.dp)) {
        items(channels, key = { it.id }) { channel ->
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Panel).clickable { onSelect(channel) }.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(48.dp).clip(RoundedCornerShape(12.dp)).background(Color(0xFF252B36)), contentAlignment = Alignment.Center) {
                    if (channel.logoUrl.startsWith("https://")) {
                        AsyncImage(
                            model = channel.logoUrl,
                            contentDescription = channel.name,
                            modifier = Modifier.fillMaxSize()
                        )
                    } else {
                        Text(channel.name.take(2).uppercase(), color = Gold, fontWeight = FontWeight.Bold)
                    }
                }
                Spacer(Modifier.width(13.dp))
                Column(Modifier.weight(1f)) {
                    Text(channel.name, color = Color.White, fontWeight = FontWeight.SemiBold)
                    Text(if (channel.language.isBlank()) channel.category else "${channel.category} • ${channel.language}", color = Muted, fontSize = 12.sp)
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

