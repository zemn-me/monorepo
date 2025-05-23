crypto-es PBKDF2 1,000 times weaker than specified in 1993 and 1.3M times weaker than current standard
------------------------------------------------------------------------------------------------------

23rd of October, 2023

| Numbering Authority | Identifier            |
|---------------------|-----------------------|
| NIST                | [CVE-2023-46133]      |
| GitHub              | [GHSA-mpj8-q39x-wq5h] |

[CVE-2023-46133]: https://nvd.nist.gov/vuln/detail/CVE-2023-46133
[GHSA-xwcq-pm8m-c4vf]: https://github.com/entronad/crypto-es/security/advisories/GHSA-mpj8-q39x-wq5h

|        | Identifier       |
|--------|------------------|
| NPM    | [crypto-es]      |
| GitHub | [entronad/crypto-es] |

[crypto-es]: https://www.npmjs.com/package/crypto-es
[entronad/crypto-es]: https://github.com/entronad/crypto-es

Maintainer: please click 'request CVE' when accepting this report so that upstream fixes of this vulnerability can be tracked. **Thank you for your hard work maintaining this package.**

### Impact
#### Summary
Crypto-js PBKDF2 is 1,000 times weaker than originally specified in 1993, and [at least 1,300,000 times weaker than current industry standard][OWASP PBKDF2 Cheatsheet]. This is because it both (1) defaults to [SHA1][SHA1 wiki], a cryptographic hash algorithm considered insecure [since at least 2005][Cryptanalysis of SHA-1] and (2) defaults to [one single iteration][one iteration src], a 'strength' or 'difficulty' value specified at 1,000 when specified in 1993. PBKDF2 relies on iteration count as a countermeasure to [preimage][preimage attack] and [collision][collision attack] attacks. Remediation of this issue might be very difficult, as the changes required to fix this issue would change the output of this method and thus break most, if not all, current uses of this method as configured by default.

Potential Impact:

1. If used to protect passwords, the impact is high.
2. If used to generate signatures, the impact is high.

Probability / risk analysis / attack enumeration:

1. [For at most $45,000][SHA1 is a Shambles], an attacker, given control of only the beginning of a crypto-js PBKDF2 input, can create a value which has _identical cryptographic signature_ to any chosen known value.
4. Due to the [length extension attack] on SHA1, we can create a value that has identical signature to any _unknown_ value, provided it is prefixed by a known value. It does not matter if PBKDF2 applies '[salt][cryptographic salt]' or '[pepper][cryptographic pepper]' or any other secret unknown to the attacker. It will still create an identical signature.

[cryptographic salt]: https://en.wikipedia.org/wiki/Salt_(cryptography) "Salt (cryptography), Wikipedia"
[cryptographic pepper]: https://en.wikipedia.org/wiki/Pepper_(cryptography) "Pepper (cryptography), Wikipedia"
[SHA1 wiki]: https://en.wikipedia.org/wiki/SHA-1 "SHA-1, Wikipedia"
[Cryptanalysis of SHA-1]: https://www.schneier.com/blog/archives/2005/02/cryptanalysis_o.html "Cryptanalysis of SHA-1"
[one iteration src]: https://github.com/brix/crypto-js/blob/1da3dabf93f0a0435c47627d6f171ad25f452012/src/pbkdf2.js#L22-L26 "crypto-js/src/pbkdf2.js lines 22-26"
[collision attack]: https://en.wikipedia.org/wiki/Hash_collision "Collision Attack, Wikipedia"
[preimage attack]: https://en.wikipedia.org/wiki/Preimage_attack "Preimage Attack, Wikipedia"
[SHA1 is a Shambles]: https://eprint.iacr.org/2020/014.pdf "SHA-1 is a Shambles: First Chosen-Prefix Collision on SHA-1
and Application to the PGP Web of Trust, Gaëtan Leurent and Thomas Peyrin"
[Length Extension attack]: https://en.wikipedia.org/wiki/Length_extension_attack "Length extension attack, Wikipedia"

crypto-js has 10,642 public users [as displayed on NPM][crypto-js, NPM], today October 11th 2023. The number of transient dependents is likely several orders of magnitude higher.

A very rough GitHub search[ shows 432 files][GitHub search: affected files] cross GitHub using PBKDF2 in crypto-js in Typescript or JavaScript, but not specifying any number of iterations.

[OWASP PBKDF2 Cheatsheet]: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#pbkdf2 "OWASP PBKDF2 Cheatsheet"
[crypto-js, NPM]: https://www.npmjs.com/package/crypto-js "crypto-js on NPM"
[GitHub search: affected files]: https://github.com/search?q=%22crypto-js%22+AND+pbkdf2+AND+%28lang%3AJavaScript+OR+lang%3ATypeScript%29++NOT+%22iterations%22&type=code&p=2 "GitHub search: crypto-js AND pbkdf2 AND (lang:JavaScript OR lang:TypeScript)  NOT iterations"

#### Affected versions
All versions are impacted. This code has been the same since crypto-js was first created.

#### Further Cryptanalysis

The issue here is especially egregious because the length extension attack makes useless any secret that might be appended to the plaintext before calculating its signature.

Consider a scheme in which a secret is created for a user's username, and that secret is used to protect e.g. their passwords. Let's say that password is 'fake-password', and their username is 'example-username'.

To encrypt the user password via symmetric encryption we might do `encrypt(plaintext: 'fake-password', encryption_key: cryptojs.pbkdf2(value: 'example username' + salt_or_pepper))`. By this means, we would, in theory, create an `encryption_key` that can be determined from the public username, but which requires the secret `salt_or_pepper` to generate. This is a common scheme for protecting passwords, as exemplified in bcrypt & scrypt. Because the encryption key is symmetric, we can use this derived key to also decrypt the ciphertext.

Because of the length extension issue, if the attacker obtains (via attack 1), a collision with 'example username', the attacker _does not need to know_ `salt_or_pepper` to decrypt their account data, only their public username.

### Description

PBKDF2 is a key-derivation function that is used for two main purposes: (1) to stretch or squash a variable length password's entropy into a fixed size for consumption by another cryptographic operation and (2) to reduce the chance of downstream operations recovering the password input (for example, for password storage).

Unlike the modern [webcrypto](https://w3c.github.io/webcrypto/#pbkdf2-operations) standard, crypto-js does not throw an error when a number of iterations is not specified, and defaults to one single iteration. In the year 1993, when PBKDF2 was originally specified, the minimum number of iterations suggested was set at 1,000. Today, [OWASP recommends 1,300,000][OWASP PBKDF2 Cheatsheet]:

https://github.com/entronad/crypto-es/blob/aa48d48413549addc06cd737a272466d5fc1b5e6/lib/pbkdf2.js#L35-L39

### Workarounds
Consult the [OWASP PBKDF2 Cheatsheet]. Configure to use SHA256 with at least 250,000 iterations.

### Coordinated disclosure
This issue was simultaneously submitted to [crypto-js](https://github.com/brix/crypto-js) and [crypto-es](https://github.com/entronad/crypto-es) on the 23rd of October 2023.

### Caveats

This issue was found in a security review that was _not_ scoped to crypto-es. This report is not an indication that crypto-es has undergone a formal security assessment by the author.


