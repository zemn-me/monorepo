target_compile_definitions(common PUBLIC LOGGING_LEVEL=4)
foreach(game VanillaRA VanillaTD)
    target_link_options(${game} PRIVATE
        -sASYNCIFY=1 -sASYNCIFY_STACK_SIZE=131072
        -sALLOW_MEMORY_GROWTH=1 -sSTACK_SIZE=8388608
        -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,node
        -sEXIT_RUNTIME=1 -sFORCE_FILESYSTEM=1
        "-sEXPORTED_RUNTIME_METHODS=['FS','IDBFS','callMain']"
        -lidbfs.js)
endforeach()
