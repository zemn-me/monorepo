import React from 'react';
import { Text, Tagged } from './component';

export const _Text = () => <>
    <Text lang={"en-GB"}>
        {['ja-JP', <>こんにちは！</>]}
    </Text>
    <Text lang={"en-GB"}>
        {['de-DE', '(das heißt hallo auf Japanisch)']}
        {['en-GB', '(that means hello in Japanese)']}
    </Text>
</>;

export const _Lang_Propagation = () => <Tagged lang="en-GB">
    <>
        <Text lang="en-GB" into={<p />}>
            {['en-GB', <>
                In this example, I have some text which has a parent context
                set to the language en-GB. As a result, any child language context
                which would normally be tagged en-GB is left untagged.
                </>]}
        </Text>

        <Text lang="en-GB" into={<p />}>
            {['ja-JP', <>こんにちは！</>]}
        </Text>
    </>
</Tagged>

export default {
    title: "linear/Text",
    component: Text
};