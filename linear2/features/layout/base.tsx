import React from 'react';

import {
    RecoilRoot,
} from 'recoil';

export const Base: React.FC = ({ children }) => <RecoilRoot>{children}</RecoilRoot>

export default Base;