# Emscripten implements OpenAL through the browser's Web Audio API.
add_library(OpenAL::OpenAL INTERFACE IMPORTED)
set_target_properties(OpenAL::OpenAL PROPERTIES
    INTERFACE_LINK_LIBRARIES "openal"
    INTERFACE_INCLUDE_DIRECTORIES "${EMSCRIPTEN_SYSROOT}/include/AL")
set(OPENAL_FOUND TRUE)
