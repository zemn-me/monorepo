// SPDX-License-Identifier: GPL-3.0-or-later
#pragma once
#include <cstdint>
#include <emscripten.h>
#include <emscripten/heap.h>
#include <ctime>
uint64_t Web_Monotonic_Nanoseconds();
int Web_Executable_Path(char *path, uint32_t *size);
void Web_Set_Arguments(int count, char **arguments);
int * Web_Argc();
char *** Web_Argv();

void Web_Display_Size(int &width, int &height);
void Web_Update_Display();
bool Web_Mouse_Hover_Active();

bool Web_Connect_Peer();

void Web_Yield(int milliseconds);
