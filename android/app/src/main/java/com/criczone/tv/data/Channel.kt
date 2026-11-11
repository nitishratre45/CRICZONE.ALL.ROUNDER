package com.criczone.tv.data

data class Channel(
    val id: String,
    val name: String,
    val category: String,
    val language: String = "—",
    val logoUrl: String? = null,
    val streamUrl: String? = null,
    val isLive: Boolean = true
)

object ChannelCatalog {
    // Demo metadata only. Add channels and licensed playback URLs through the admin API.
    val demo = listOf(
        Channel("sports-1", "Sports One", "Cricket", "Hindi"),
        Channel("sports-2", "Sports Two", "Cricket", "English"),
        Channel("football-1", "Football Live", "Football", "English"),
        Channel("tennis-1", "Tennis Live", "Tennis", "English")
    )
}
