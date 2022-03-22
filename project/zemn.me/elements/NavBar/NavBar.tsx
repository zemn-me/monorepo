import ZemnmezLogo from 'project/zemn.me/elements/ZemnmezLogo';
import React from 'react';
import style from './NavBar.module.css';
import { Link } from 'react-router-dom';

export const NavBar: React.FC = () => <div className={style.navbar}>
    <Link to="/" className={style.logo}>
        <ZemnmezLogo className={style.logoInner}/>
    </Link>
</div>

export default NavBar;
