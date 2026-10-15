# SPDX-License-Identifier: GPL-3.0-or-later
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(BGFX_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(BGFX_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(BGFX_INSTALL OFF CACHE BOOL "" FORCE)
set(BGFX_CONFIG_RENDERER_WEBGPU OFF CACHE BOOL "" FORCE)
add_subdirectory(bgfx.cmake)
set_target_properties(bimg_decode bimg_encode PROPERTIES EXCLUDE_FROM_ALL TRUE)

add_library(miniaudio STATIC miniaudio-impl.c)
target_include_directories(miniaudio PUBLIC miniaudio)
target_compile_definitions(miniaudio PUBLIC
    MA_NO_ENGINE MA_NO_NODE_GRAPH MA_NO_RESOURCE_MANAGER MA_NO_GENERATION MA_NO_ENCODING)

file(GLOB LZO_SOURCES CONFIGURE_DEPENDS "lzo/src/*.c")
add_library(lzo STATIC ${LZO_SOURCES})
target_include_directories(lzo PUBLIC lzo/include PRIVATE lzo/src)

foreach(feature ZLIB BZIP2 PNG HARFBUZZ BROTLI)
    set(FT_DISABLE_${feature} ON CACHE BOOL "" FORCE)
endforeach()
set(SKIP_INSTALL_ALL ON CACHE BOOL "" FORCE)
add_subdirectory(freetype)
add_library(Freetype::Freetype ALIAS freetype)
set(CMAKE_DISABLE_FIND_PACKAGE_Freetype ON)
set(RMLUI_FONT_ENGINE "freetype" CACHE STRING "" FORCE)
foreach(feature SAMPLES LUA_BINDINGS LOTTIE_PLUGIN SVG_PLUGIN TRACY_PROFILING)
    set(RMLUI_${feature} OFF CACHE BOOL "" FORCE)
endforeach()
add_subdirectory(RmlUi)

add_library(imgui STATIC imgui/imgui.cpp imgui/imgui_demo.cpp imgui/imgui_draw.cpp
    imgui/imgui_tables.cpp imgui/imgui_widgets.cpp)
target_include_directories(imgui PUBLIC imgui)
target_compile_definitions(imgui PUBLIC IMGUI_DISABLE_OBSOLETE_FUNCTIONS)

set(SDL_SHARED OFF CACHE BOOL "" FORCE)
set(SDL_STATIC ON CACHE BOOL "" FORCE)
set(SDL_VIDEO ON CACHE BOOL "" FORCE)
set(SDL_OPENGLES ON CACHE BOOL "" FORCE)
foreach(feature TEST_LIBRARY TESTS EXAMPLES INSTALL AUDIO GPU RENDER CAMERA JOYSTICK
        HAPTIC HIDAPI POWER SENSOR DIALOG TRAY OPENGL VULKAN OFFSCREEN)
    set(SDL_${feature} OFF CACHE BOOL "" FORCE)
endforeach()
add_subdirectory(SDL)
