// SPDX-License-Identifier: GPL-3.0-or-later
#include "platform.h"
#include "choosefolder.h"
#include "goptions.h"
#include "misc.h"
#include "globals.h"
#include "session.h"
#include "video.h"
#include "audio/audioengine.h"
#include "gamewindow.h"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <cstdlib>
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

// Window and screen dimensions share CSS units, independent of pixel density.
EM_JS(int, Web_Window_Width, (), { return window.innerWidth; });
EM_JS(int, Web_Window_Height, (), { return window.innerHeight; });
EM_JS(double, Web_Screen_Scale, (), {
    const width = window.screen?.width;
    const height = window.screen?.height;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 1;
    // Keep the original 800x600 view at a consistent fraction of the display.
    // Browsers do not expose reliable physical dimensions in inches or cm.
    return Math.max(1, Math.min(width / 800, height / 600));
});
// Use the logical frame's aspect, rather than SDL's rounded drawable size, so
// containing the canvas cannot feed rounding errors back into the next resize.
EM_JS(void, Web_Display_Aspect, (int width, int height), {
    Module.canvas.style.setProperty('--game-aspect', String(width / height));
});
void Web_Display_Size(int &width, int &height) {
    // Select_Game marks GameActive before a player or scenario exists. Shell
    // menus still need fixed pixel artwork until gameplay has an actual player.
    // Let CSS contain-scale that canvas; gameplay follows the viewport.
    if (!GameActive || PlayerPtr == nullptr) {
        width = 800;
        height = 600;
        Web_Display_Aspect(width, height);
        return;
    }
    double displayScale = Web_Screen_Scale();
    double w = std::max(1, Web_Window_Width()) / displayScale;
    double h = std::max(1, Web_Window_Height()) / displayScale;
    // Small windows retain the game's minimum usable area; very large displays
    // cap the software framebuffer's cost while preserving the window's aspect.
    double scale = std::max({1.0, 800.0 / w, 600.0 / h});
    scale = std::min(scale, std::min(4096.0 / w, 4096.0 / h));
    width = std::max(800, (int)std::lround(w * scale));
    height = std::max(600, (int)std::lround(h * scale));
    Web_Display_Aspect(width, height);
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

namespace { bool StopRequested = false; }
extern "C" EMSCRIPTEN_KEEPALIVE void Web_Request_Stop() { StopRequested = true; }

// Asyncify must release the stack so network messages and input can run.
// Hidden multiplayer cannot resume through setTimeout: browser timer clamping
// stalls this peer and therefore every peer in the native lockstep protocol.
EM_JS(int, Web_Document_Hidden, (), { return document.hidden; });
EM_ASYNC_JS(void, Web_Yield_Task, (), { await Module.webYield(); });

void Web_Yield(int milliseconds) {
    const bool multiplayer = Session.Type == GAME_IPX || Session.Type == GAME_INTERNET;
    if (GameActive && multiplayer && milliseconds <= 1 && Web_Document_Hidden()) {
        // FramePacer still controls simulation time. These short waits only
        // yield cooperatively; they must not depend on a hidden-tab timer.
        Web_Yield_Task();
    } else {
        emscripten_sleep(milliseconds);
    }
    // Unmount can arrive while Asyncify has suspended the engine. Exit after
    // resuming on its own stack so its registered shutdown handlers can run.
    if (StopRequested) {
        StopRequested = false;
        AudioEngine.End();
        Game_Window_Begin_Shutdown();
        emscripten_force_exit(EXIT_SUCCESS);
    }
}
