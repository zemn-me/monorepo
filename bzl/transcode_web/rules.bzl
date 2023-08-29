"""
Transcode a video source for use on the web.
"""

def transcode_web(name, src = None, out_base_name = "out", max_bitrate = "4.5M", video_scale = "1280:720"):
    native.genrule(
        name = name + "_mp4",
        srcs = [src, "//bin/host/ffmpeg"],
        cmd = """
            $(location //bin/host/ffmpeg) -i $(location """ + src + """) \\
                -c:v libx264 \\
                -an \\
                -bufsize 2M \\
                -maxrate """ + max_bitrate + """ \\
                -crf 30 \\
                -vf scale=""" + video_scale + """ \\
                -movflags +faststart $@ \\
                -loglevel error
        """,
        outs = [out_base_name + ".mp4"],
    )

    native.genrule(
        name = name + "_webm",
        srcs = [src, "//bin/host/ffmpeg"],
        cmd = """
            $(location //bin/host/ffmpeg) -i $(location """ + src + """) \\
                -c:v libvpx \\
                -crf 30 \\
                -bufsize 2M \\
                -an \\
                -maxrate """ + max_bitrate + """ \\
                -vf scale=""" + video_scale + """ \\
                -movflags +faststart $@ \\
                -loglevel error
        """,
        outs = [out_base_name + ".webm"],
    )

    native.genrule(
        name = name + "_ogv",
        srcs = [src, "//bin/host/ffmpeg"],
        cmd = """
            $(location //bin/host/ffmpeg) -i $(location """ + src + """) \\
                -c:v libtheora \\
                -an \\
                -bufsize 2M \\
                -crf 30 \\
                -maxrate """ + max_bitrate + """ \\
                -vf scale=""" + video_scale + """ \\
                -movflags +faststart $@ \\
                -loglevel error
        """,
        outs = [out_base_name + ".ogv"],
    )

    native.filegroup(
        name = name,
        srcs = [
            name + "_ogv",
            name + "_webm",
            name + "_mp4",
        ],
    )
