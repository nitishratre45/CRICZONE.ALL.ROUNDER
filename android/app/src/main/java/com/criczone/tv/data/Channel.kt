package com.criczone.tv.data

import android.content.Context
import org.json.JSONObject

data class Channel(
    val id: String,
    val name: String,
    val category: String,
    val language: String = "",
    val logoUrl: String = "",
    val playerPageUrl: String = "",
    val streamType: String = "",
    val source: String = "",
    val sourceId: String = "",
    val sourceIds: List<String> = emptyList(),
    val isLive: Boolean = false
)

object ChannelCatalog {
    /**
     * Reads the repository-generated, metadata-only catalogue bundled in assets.
     * Raw upstream media URLs, DRM directives, tokens and request headers are
     * deliberately excluded from the Android catalogue.
     */
    fun load(context: Context): List<Channel> {
        return try {
            val json = context.assets.open("channel-catalog.json")
                .bufferedReader(Charsets.UTF_8).use { it.readText() }
            val root = JSONObject(json)
            val rows = root.getJSONArray("channels")
            buildList(rows.length()) {
                for (i in 0 until rows.length()) {
                    val row = rows.getJSONObject(i)
                    add(
                        Channel(
                            id = row.optString("id"),
                            name = row.optString("name", "Unnamed channel"),
                            category = row.optString("category", "Other"),
                            language = row.optString("language"),
                            logoUrl = row.optString("logoUrl"),
                            playerPageUrl = row.optString("playerPageUrl"),
                            streamType = row.optString("streamType"),
                            source = row.optString("source"),
                            sourceId = row.optString("sourceId"),
                            sourceIds = buildList {
                                if (row.has("sourceIds")) {
                                    val ids = row.optJSONArray("sourceIds")
                                    if (ids != null) for (index in 0 until ids.length()) {
                                        val value = ids.optString(index)
                                        if (value.isNotBlank()) add(value)
                                    }
                                }
                                val primary = row.optString("sourceId")
                                if (primary.isNotBlank() && primary !in this) add(primary)
                            }
                        )
                    )
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }
}
