package com.criczone.tv.data

import android.content.Context
import android.net.Uri
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
     * Loads channel metadata and overlays CRICZONE-owned iframe player pages
     * from the bundled copy of criczone/links.json. Raw media URLs, DRM data,
     * expiring tokens, cookies and request headers are never imported.
     */
    fun load(context: Context): List<Channel> {
        return try {
            val catalogText = context.assets.open("channel-catalog.json")
                .bufferedReader(Charsets.UTF_8).use { it.readText() }
            val root = JSONObject(catalogText)
            val rows = root.getJSONArray("channels")
            val channels = buildList(rows.length()) {
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
                                val ids = row.optJSONArray("sourceIds")
                                if (ids != null) for (index in 0 until ids.length()) {
                                    val value = ids.optString(index)
                                    if (value.isNotBlank()) add(value)
                                }
                                val primary = row.optString("sourceId")
                                if (primary.isNotBlank() && primary !in this) add(primary)
                            }
                        )
                    )
                }
            }.toMutableList()

            val iframeText = context.assets.open("criczone-iframes.json")
                .bufferedReader(Charsets.UTF_8).use { it.readText() }
            val iframeRows = JSONObject(iframeText).optJSONArray("iframes")
                ?: return channels

            fun normalized(value: String) = value.lowercase().filter { it.isLetterOrDigit() }

            for (i in 0 until iframeRows.length()) {
                val row = iframeRows.getJSONObject(i)
                val id = row.optString("id")
                val name = row.optString("name")
                val category = row.optString("category", "Sports")
                val url = row.optString("iframeSrc")
                val uri = Uri.parse(url)

                // Only CRICZONE's HTTPS player pages are accepted from this JSON.
                if (id.isBlank() || name.isBlank() || uri.scheme != "https" ||
                    uri.host != "criczone.pages.dev" || !url.startsWith("https://criczone.pages.dev/")
                ) continue

                val matchingIndexes = channels.indices.filter {
                    normalized(channels[it].name) == normalized(name)
                }
                if (matchingIndexes.isNotEmpty()) {
                    matchingIndexes.forEach { index ->
                        channels[index] = channels[index].copy(
                            playerPageUrl = url,
                            streamType = "iframe",
                            source = "criczone/links.json"
                        )
                    }
                } else {
                    channels.add(
                        Channel(
                            id = "iframe-${id.lowercase()}",
                            name = name,
                            category = category,
                            playerPageUrl = url,
                            streamType = "iframe",
                            source = "criczone/links.json",
                            sourceId = id,
                            sourceIds = listOf(id)
                        )
                    )
                }
            }
            channels
        } catch (_: Exception) {
            emptyList()
        }
    }
}
