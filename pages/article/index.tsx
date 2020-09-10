import Home from 'pages';
import React from 'react';

const El:
    () => React.ReactElement
=
    () => 
        <Home filter={
            event => !!event.tags?.some(([lang, s]) =>  lang == "en-GB" && s == "writing")
        }/>
    
;

export default El;