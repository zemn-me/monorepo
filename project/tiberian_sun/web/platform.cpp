// SPDX-License-Identifier: GPL-3.0-or-later
#include "platform.h"
#include "choosefolder.h"
#include "goptions.h"
#include "misc.h"
#include "globals.h"
#include "video.h"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>
namespace { int Count; char **Arguments; }
uint64_t Web_Monotonic_Nanoseconds() { return static_cast<uint64_t>(emscripten_get_now() * 1000000.0); }
int Web_Executable_Path(char *path, uint32_t *size) {
    constexpr char Name[] = "/game/opents";
    if (*size < sizeof(Name)) { *size = sizeof(Name); return -1; }
    memcpy(path, Name, sizeof(Name)); return 0;
}
void Web_Set_Arguments(int count, char **arguments) { Count=count; Arguments=arguments; }
int * Web_Argc() { return &Count; }
char *** Web_Argv() { return &Arguments; }
std::string Choose_Folder(char const *) { return {}; }
void Show_Alert(char const *title, char const *text) { fprintf(stderr,"%s: %s\n",title,text); }

// CSS pixels keep the original pixel-art controls usable on high-density displays.
EM_JS(int, Web_Window_Width, (), { return window.innerWidth; });
EM_JS(int, Web_Window_Height, (), { return window.innerHeight; });
void Web_Display_Size(int &width, int &height) {
    double w = std::max(1, Web_Window_Width());
    double h = std::max(1, Web_Window_Height());
    // Small windows retain the game's minimum usable area; very large displays
    // cap the software framebuffer's cost while preserving the window's aspect.
    double scale = std::max({1.0, 800.0 / w, 600.0 / h});
    scale = std::min(scale, std::min(4096.0 / w, 4096.0 / h));
    width = std::max(800, (int)std::lround(w * scale));
    height = std::max(600, (int)std::lround(h * scale));
}

bool Change_Display_Mode(int width, int height);
void Web_Update_Display() {
    int width, height;
    Web_Display_Size(width, height);
    static int pendingWidth = 0, pendingHeight = 0;
    static double changedAt = 0;
    if (width != pendingWidth || height != pendingHeight) {
        pendingWidth = width;
        pendingHeight = height;
        changedAt = emscripten_get_now();
    }
    if ((width != VideoModeWidth || height != VideoModeHeight) && emscripten_get_now() - changedAt >= 150) {
        if (Change_Display_Mode(width, height)) {
            Options.ScreenWidth = width;
            Options.ScreenHeight = height;
        }
    }
}
