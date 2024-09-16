# `Zstandard` codec for `avsc`

[Zstandard](https://github.com/facebook/zstd) codec for [avsc](https://github.com/mtth/avsc).

Example:

```ts
import Avro from "avsc";
import {
  createDecoderMixin,
  createEncoderMixin,
  codecName,
} from "@planet-a/avsc-zstandard-codec";

const mySchema = Avro.Type.forSchema({ type: "string" });

{
  // encode
  const fileEncoder = Avro.createFileEncoder("./my.avro", mySchema, {
    codec: codecName,
    codecs: {
      ...Avro.streams.BlockEncoder.defaultCodecs(),
      ...createEncoderMixin(),
    },
  });

  fileEncoder.write("Hello");
  fileEncoder.write("World");
  fileEncoder.end();
  await finished(fileEncoder);
}

{
  // decode
  const fileDecoder = Avro.createFileDecoder("./my.avro", {
    codecs: {
      ...Avro.streams.BlockEncoder.defaultCodecs(),
      ...createDecoderMixin(),
    },
  });

  fileDecoder.on("data", console.log.bind(console));
  await finished(fileDecoder);
}
```

## Why `@mongodb-js/zstd`?

It uses the [@mongodb-js/zstd](https://github.com/mongodb-js/zstd) package, as this package has a few advantages:

- The `decompress` function does not need the uncompressed buffer size in advance, a restriction which most other WASM-based implementations have and renders them unusable for this task
- It works with `Buffer`. Whilst a `Uint8Array` implementation would be more portable (I am looking at you, Deno), `avsc` itself is still using `Buffer`. When/if https://github.com/mtth/avsc/pull/452 lands, we might have some more options of what packages to use.

## A note about `Snowflake` compatibility

You'll see that the current implementation uses defaults from the [Avro repository](https://github.com/apache/avro).

Namely

- codec name (if you don't adhere to `zstandard` the file won't be readable at all)
- whether to use a checksum or not (with checksum, the metadata will be readable, but the data will yield an error (`Could not read file`)).

The reason for that is, that in order to make the Avro export as portable as possible, we need to make sure that none of these things need to be specified. A prime example of that is for example Snowflake's Avro support ([`COPY INTO`](https://docs.snowflake.com/en/sql-reference/sql/copy-into-table)). Specifically, if you alter the codec name and/or the checksum flag, you won't be able to use the generated Avro files via their product.
