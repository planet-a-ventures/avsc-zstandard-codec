import { compress, decompress } from "@mongodb-js/zstd";
import Avro from "avsc";
import crc32 from "buffer-crc32";
import assert from "node:assert";
import { z } from "zod";

const optionsSchema = z.object({
  name: z
    .string()
    .min(1)
    .optional()
    /**
     * to match https://github.com/apache/avro/blob/e60cb41936cec515d9a1123ccf7b03b05fe573dc/lang/java/avro/src/main/java/org/apache/avro/file/DataFileConstants.java#L41
     */
    .default("zstandard"),
  compression: z
    .number()
    .int()
    .min(-7)
    .max(22)
    .optional()
    /**
     * to match https://github.com/apache/avro/blob/e60cb41936cec515d9a1123ccf7b03b05fe573dc/lang/java/avro/src/main/java/org/apache/avro/file/ZstandardCodec.java#L30
     */
    .default(3),

  useChecksum: z
    .boolean()
    .optional()
    /**
     * By default, zstandard does not use a checksum
     * See https://github.com/apache/avro/blob/e60cb41936cec515d9a1123ccf7b03b05fe573dc/lang/java/avro/src/main/java/org/apache/avro/file/CodecFactory.java#L141
     */
    .default(false),
});

export type Options = z.infer<typeof optionsSchema>;
export const defaultOptions: Options = optionsSchema.parse({});
export const codecName = defaultOptions.name;

export class ChecksumError extends Error {
  constructor() {
    super("invalid checksum");
    this.name = "ChecksumError";
  }
}

export function createEncoderMixin(
  options: z.input<typeof optionsSchema> = {},
): Avro.CodecOptions {
  const { name, compression, useChecksum } = optionsSchema.parse(options);
  return {
    [name]: (buf, cb) => {
      compress(buf, compression)
        .then((deflated) => {
          if (useChecksum) {
            const checksum = crc32(buf);
            cb(null, Buffer.concat([deflated, checksum]));
          } else {
            cb(null, deflated);
          }
        })
        .catch(cb);
    },
  };
}

export function createDecoderMixin(
  options: z.input<typeof optionsSchema> = {},
): Avro.CodecOptions {
  const { name, useChecksum } = optionsSchema.parse(options);
  return {
    [name]: (buf, cb) => {
      decompress(useChecksum ? buf.subarray(0, buf.length - 4) : buf)
        .then((inflated) => {
          if (useChecksum) {
            const checksum = buf.subarray(buf.length - 4, buf.length);
            assert(checksum.equals(crc32(inflated)), new ChecksumError());
          }
          cb(null, inflated);
        })
        .catch(cb);
    },
  };
}
