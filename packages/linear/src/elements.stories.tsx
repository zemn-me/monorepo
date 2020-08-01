import React from 'react';

import {
  Em, A, H1, H2, P, Input, Strong, Hr, Main, Div, MainProps
} from './elements';

import * as elements from './elements';

export const Putting_It_All_Together = (props: MainProps = {}) => <Main {...props}>
  <H1>Welcome to my Document!!</H1>

  <P>
    This is a paragraph. It has <A href="https://google.com">links, even!</A>
  </P>

  <P>
    Having a <Em>good</Em> time in the sun!
  </P>

  <H2>Handling Dogs</H2>

  <P>If you are handling a dog <Strong>please make sure to pet the dog!</Strong></P>

  <P>Please input <Input placeholder="username" type="text" />; <Input type="text" placeholder="password" /></P>

  <P>Later...</P>

  <Hr />

  <P>Remember the dog!!</P>

</Main>;

export const Dark_Mode = () => <Putting_It_All_Together dark={true} />

export const _Em = () => <Em>feelin' good</Em>

export const _A = () => <A href="https://google.com">
  A link!!
</A>;

export const _H1 = () => <H1>
  Heading!
</H1>;

export const _H2 = () => <H2>
  H2!
</H2>

export const _P = () => <P>
  A paragraph. A paragraph can be very long and have a lot of words in it.
  You can use any words you want.
</P>

export const _Input = () => <Input placeholder="Username" />;

export const _Strong = () => <Strong>feelin powerful</Strong>;

export const _Hr = () => <Hr />

export const _Div = () => <Div>Joust a simple div, mate!!</Div>;


export default {
  title: 'linear/elements',
  component: elements.A,
  subcomponents: elements
}
