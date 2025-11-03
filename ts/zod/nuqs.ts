import { createParser } from 'nuqs/server'
import { z } from 'zod'

export function createZodCodecParser<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Input extends z.ZodCoercedString<string> | z.ZodPipe<any, any>,
  Output extends z.ZodType
>(
  codec: z.ZodCodec<Input, Output> | z.ZodPipe<Input, Output>,
  eq: (a: z.output<Output>, b: z.output<Output>) => boolean = (a, b) => a === b
) {
  return createParser<z.output<Output>>({
    parse(query) {
      return codec.parse(query)
    },
    serialize(value) {
      return codec.encode(value)
    },
    eq
  })
}

// --

// All parsers from the Zod docs:
export const jsonCodec = <T extends z.core.$ZodType>(schema: T) =>
  z.codec(z.string(), schema, {
    decode: (jsonString, ctx) => {
      try {
        return JSON.parse(jsonString)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        ctx.issues.push({
          code: 'invalid_format',
          format: 'json',
          input: jsonString,
          message: err.message
        })
        return z.NEVER
      }
    },
    encode: value => JSON.stringify(value)
  })

export const base64urlToBytes = z.codec(z.base64url(), z.instanceof(Uint8Array), {
  decode: base64urlString => z.util.base64urlToUint8Array(base64urlString),
  encode: bytes => z.util.uint8ArrayToBase64url(bytes)
})

export const utf8ToBytes = z.codec(z.string(), z.instanceof(Uint8Array), {
  decode: str => new TextEncoder().encode(str),
  encode: bytes => new TextDecoder().decode(bytes)
})

export const bytesToUtf8 = invertCodec(utf8ToBytes)

function invertCodec<A extends z.ZodType, B extends z.ZodType>(
  codec: z.ZodCodec<A, B>
): z.ZodCodec<B, A> {
  return z.codec<B, A>(codec.out, codec.in, {
    decode(value, ctx) {
      try {
        return codec.encode(value)
      } catch (err) {
        ctx.issues.push({
          code: 'invalid_format',
          format: 'invert.decode',
          input: String(value),
          message: err instanceof z.ZodError ? err.message : String(err)
        })
        return z.NEVER
      }
    },
    encode(value, ctx) {
      try {
        return codec.decode(value)
      } catch (err) {
        ctx.issues.push({
          code: 'invalid_format',
          format: 'invert.encode',
          input: String(value),
          message: err instanceof z.ZodError ? err.message : String(err)
        })
        return z.NEVER
      }
    }
  })
}
