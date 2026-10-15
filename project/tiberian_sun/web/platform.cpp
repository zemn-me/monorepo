// SPDX-License-Identifier: GPL-3.0-or-later
#include "platform.h"
#include "choosefolder.h"
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
