// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 Thomas Shadwell

#include "lcw.h"

namespace {
constexpr int Capacity = 32768;
unsigned char Input[Capacity];
unsigned char Compressed[LCW_Comp_Bound(Capacity)];
unsigned char Decoded[Capacity];
int CompressedSize = 0;
}

extern "C" {
unsigned char * input_data() { return Input; }
unsigned char * compressed_data() { return Compressed; }
unsigned char * decoded_data() { return Decoded; }
int input_capacity() { return Capacity; }
int compressed_size() { return CompressedSize; }

// Only decode output produced here: upstream's decoder has no source-size bound.
int round_trip(int length) {
    CompressedSize = 0;
    if (length <= 0 || length > Capacity) return -1;
    CompressedSize = LCW_Comp(Input, Compressed, length);
    auto decoded_size = LCW_Uncomp(Compressed, Decoded, length);
    if (decoded_size != static_cast<unsigned>(length)) return -2;
    for (int i = 0; i < length; ++i) {
        if (Input[i] != Decoded[i]) return -3;
    }
    return static_cast<int>(decoded_size);
}
}
