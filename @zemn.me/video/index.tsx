import * as React from 'react';
import poster from './ash.jpg';
import ashVideo from './ash.mp4';
import style from './video.module.css';
import classes from '@zemn.me/linear/classes';

export interface Video {

}

const Video:
    React.FC<Video>
= ({ className, ...etc }) => <video
    {...{
        autoPlay: true,
        loop: true,
        poster: poster,
        playsInline: true,
        ...classes(style.Video, className),
        ...etc
    }}>

        <source src={ashVideo} type="video/mp4"/>
    </video>

export default Video;