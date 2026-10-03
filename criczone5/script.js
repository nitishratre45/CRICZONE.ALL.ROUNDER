/* =========================================
   STREAMS MAPPING
========================================= */
const streamMap = {
    "TEN3HD": "https://sliv.tgaadi.workers.dev/ten3hd.m3u8",
    "TEN1HD": "https://sliv.tgaadi.workers.dev/ten1hd.m3u8",
    "TEN2HD": "https://sliv.tgaadi.workers.dev/ten2hd.m3u8",
    "TEN5HD": "https://sliv.tgaadi.workers.dev/sonysixhd.m3u8",
    "TEN1SD": "https://sliv.tgaadi.workers.dev/ten1sd.m3u8",
    "TEN2SD": "https://sliv.tgaadi.workers.dev/ten2sd.m3u8",
    "TEN3SD": "https://sliv.tgaadi.workers.dev/ten3sd.m3u8",
    "TEN5SD": "https://sliv.tgaadi.workers.dev/ten5sd.m3u8",
    "4249779_ENG": "https://in-mc-flive.fancode.com/mumbai/4249779_english_hls_5b5f2be03a98278_1ta-di_h264/1080p.m3u8?hdntl=Expires=1790581085~_GO=Generated~acl=/mumbai/4249779_english_hls_5b5f2be03a98278_1ta-di_h264/*~Signature=AUh_zpXFFvBB8PuYQyTwqkTbh5t9O99Uz2sf4GLwTO5cw_FC4K23xHq_UDqNKAUSqVOmXusOwFRDws5oXvKk6aY-YtcN",
    "Tnt1": "https://epidd.hundxvision.co.uk/main/secure/2c5fa672fc1f14780183b4e11f3b27649f93803293afbbd1c8360c54237fa2c5/1789830632/tntsports1-uk.m3u8",
    "SKYEVENT": "https://juxrd.hundxvision.co.uk/main/secure/6bc9bfc697ee9af92f1c87b3311402b9473d49a5337a8d0001fec18e8903f6a5/1789918310/skysportsmainevent-uk.m3u8",
    "SKYPREM": "https://juxrd.hundxvision.co.uk/main/secure/fc781f666b61d48a007d8bf2bd8ae2c483d0e21d9590bedf6ab0339da39662a1/1789918532/skysportspremierleague-uk.m3u8",
    "TNTSPORTSHD": "https://xstm.250909.cc/live/SPORTSFLUX-PRD-76753-1/4a7a4af09781/1034.m3u8",
    "RALLYTV": "https://dms.redbull.tv/v5/destination/rallytv/07f960dc-fd36-466c-971f-64a597518b83/personal_computer/http/us/es_US/playlist.m3u8",
    "SKYSPORTNZ1": "https://tmaxapp.site/skynz2.m3u8",
    "LIVEHD": "https://tmaxapp.site/willoweng.m3u8",
    "S2": "https://amg01269-amg01269c1-sportstribal-emea-5204.playouts.now.amagi.tv/ts-eu-w1-n2/playlist/amg01269-willowtvfast-willowplus-sportstribalemea/cb573d1c796c64899ad43678d1f74382917b3dcb0e6c886470af4a9765d96300dbf9b9c8fd3ab13c1ec0468a710b6b5a4d05b671db7c02c5c76ad91174204213cfcac9229d86170ab5c60c2c3aab016635837209c0790a79dca93d0d8636ba304530e01b615b37c2ec5da46852db87028978378aabde7144220806c3084d86f108f2bdb84240db6bbfb21a5a817e13efd342c1821aa687d15d975e8777a71580c3a18e810dd1809564af55b0630b5e242aab9513fca1cb69f7e00b10b2334d6f1051efa2e191245ea77433977c62a9c501de00c7885fed089c302dea29a9258769ab00e59426625b96ad206c11deaf76602fa1f7a199f32121bc2c93c88f89232cc9a5472a05a169a9e7f699e7bbb847a4baeea349e848ec5b3d72acb056929cfda8e0bc864b8824f03c95f2276f41790d0e8a5cedcf238b699554a1c00639070d65a39e47cb8fdd1e613414c6b273ec464bea89c2c3fe1e2bc6652c5fea4bd04f4a399f63222fb36db1b11458a40a46c53934f05d75a747ffb323bce7f8ed1434b8db8813ab36a1e54485ae50fe236d0f51f3df235d4c407890dd670b316bca0ab1809daf245f72819daadfce572a083013206edab49d1ed9e2ed261f1fcd5666507c1f19930eb5388a54a9619a56ea61ca4610e87672dd4ca0601f3847325772f0/154/720x404_1513283/index.m3u8",
    "BACKUPHD": "https://27lftgqlgzmy.windows-devs.top/AccessLog2/83_FHD/apache.m3u8"
};

// Player engine function update:
function startStream(channelKey) {
    const streamUrl = streamMap[channelKey];
    if (!streamUrl) return;

    document.getElementById('home-section').style.display = 'none';
    document.getElementById('player-section').style.display = 'flex';
    document.getElementById('back-btn').style.display = 'flex';
    document.getElementById('active-channel-name').innerText = channelKey;

    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?channel=' + encodeURIComponent(channelKey);
    window.history.pushState({ path: newUrl }, '', newUrl);

    if (art) art.destroy(true);
    if (activeHls) activeHls.destroy();

    art = new Artplayer({
        container: '#artplayer',
        url: streamUrl,
        type: 'm3u8',
        autoplay: true,
        isLive: true,
        fullscreen: true,
        fullscreenWeb: true,
        pip: true,
        setting: true,
        playbackRate: true,
        aspectRatio: true,
        theme: '#38bdf8',
        customType: {
            m3u8: function (video, url) {
                if (Hls.isSupported()) {
                    const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
                    activeHls = hls;
                    hls.loadSource(url);
                    hls.attachMedia(video);

                    hls.on(Hls.Events.MANIFEST_PARSED, function () {
                        video.play().catch(() => {});
                    });

                    art.on('destroy', () => hls.destroy());
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    video.src = url;
                }
            },
        },
    });
}
