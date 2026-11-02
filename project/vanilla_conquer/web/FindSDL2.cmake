# Compile pinned SDL rather than fetching an Emscripten port during the action.
add_subdirectory("${CMAKE_SOURCE_DIR}/sdl2" "${CMAKE_BINARY_DIR}/sdl2")
set(SDL2_LIBRARY SDL2-static)
set(SDL2_INCLUDE_DIR "${CMAKE_SOURCE_DIR}/sdl2/include")
set(SDL2_FOUND TRUE)
