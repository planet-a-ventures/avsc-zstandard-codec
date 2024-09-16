import Avro from "avsc";
import { memfs } from "memfs";
import assert from "node:assert";
import { finished } from "node:stream/promises";
import { afterEach, beforeEach, suite, test } from "node:test";
import { promisify } from "node:util";
import {
  codecName,
  createDecoderMixin,
  createEncoderMixin,
  Options,
} from "../index";

suite("avsc-zstandard-codec", async () => {
  let m: ReturnType<typeof memfs>;

  beforeEach(async () => {
    m = memfs();
  });

  afterEach(async () => {
    // TODO(@joscha) This errors because of unclosed streams but only happens with the memfs implementation
    // m.vol.reset();
  });

  async function decode(path: string, options: Partial<Options> = {}) {
    const results: string[] = [];
    const decoder = m.fs
      .createReadStream(path)
      .pipe(
        new Avro.streams.BlockDecoder({
          codecs: {
            ...createDecoderMixin(options),
          },
        }),
      )
      .on("data", results.push.bind(results));
    await finished(decoder);
    return results;
  }

  async function encode(
    mySchema: Avro.Type,
    input: string[],
    path: string,
    options: Partial<Options> = {},
  ) {
    {
      const encoder = new Avro.streams.BlockEncoder(mySchema, {
        codec: codecName,
        codecs: {
          ...createEncoderMixin(options),
        },
      });
      const fstream = m.fs.createWriteStream(path, { encoding: "binary" });
      encoder.pipe(fstream);
      for (const i of input) {
        encoder.write(i);
      }
      await promisify(encoder.end.bind(encoder))();
      await finished(fstream);
    }
  }

  await test("can write and read", async (t) => {
    const mySchema = Avro.Type.forSchema({ type: "string" });
    const input = ["Hello", "World"];
    const path = "/my.avro";

    await encode(mySchema, input, path);
    assert(path in m.vol.toJSON());

    // we can't use snapshot tests here as the compressed binary data is not deterministic
    assert.strictEqual(m.vol.readFileSync(path, "binary").length, 103);

    const results = await decode(path);
    assert.deepStrictEqual(results, input);
  });

  test("can write and read with checksum", async () => {
    const mySchema = Avro.Type.forSchema({ type: "string" });
    const input = ["Hello", "World"];
    const path = "/my.avro";

    await encode(mySchema, input, path, { useChecksum: true });
    assert(path in m.vol.toJSON());

    // we can't use snapshot tests here as the compressed binary data is not deterministic
    assert.strictEqual(m.vol.readFileSync(path, "binary").length, 107);

    const results = await decode(path, { useChecksum: true });
    assert.deepStrictEqual(results, input);
  });
});
