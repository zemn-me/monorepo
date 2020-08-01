import * as sort from 'linear/component/Sort';
import * as bio from 'linear/bio';
import * as timeline from 'linear/component/timeline';
import React from 'react';


export const Sort = () => <div>
    <sort.Sort {...{
        items: bio.Bio.timeline.map(({ priority, ...etc }) => ({
            value: {
                priority,
                ...etc
            },
        }))
    }}/>
</div>


