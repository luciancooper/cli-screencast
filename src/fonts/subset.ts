import path from 'path';
import { promises as fs } from 'fs';
import type { SystemFontData } from './types';
import { getFontBuffer } from './utils';

declare global {
    const WebAssembly: {
        instantiate: <T>(
            bufferSource: Buffer,
            importObject: {
                env: {
                    emscripten_notify_memory_growth: (...args: any[]) => any
                }
            },
        ) => Promise<{ instance: { exports: T } }>
    };
}

interface HarfbuzzSubset {
    memory: { buffer: Buffer }

    /**
     * Creates a new "blob" object wrapping data.
     * The mode parameter is used to negotiate ownership and lifecycle of data
     */
    hb_blob_create: (data: number, length: number, mode: number, user_data: number, destroy: number) => number

    /**
     * Decreases the reference count on blob , and if it reaches zero, destroys blob, freeing all memory, possibly
     * calling the destroy-callback the blob was created for if it has not been called already.
    */
    hb_blob_destroy: (blob: number) => void

    /** */
    free: (data: any) => void

    /** Fetches the length of a blob's data. */
    hb_blob_get_length: (blob: number) => number

    /** Fetches the data from a blob */
    hb_blob_get_data: (blob: number, length: number) => number

    /** Allocates size bytes of uninitialized storage */
    malloc: (size: number) => number

    /** Fetches the singleton empty face object. */
    hb_face_get_empty: () => number

    /** Constructs a new face object from the specified blob and a face index into that blob. */
    hb_face_create: (blob: number, index: number) => number

    /**
     * Decreases the reference count on a face object.
     * When the reference count reaches zero, the face is destroyed, freeing all memory.
     */
    hb_face_destroy: (face: number) => void

    /**
     * Fetches a pointer to the binary blob that contains the specified face.
     * Returns an empty blob if referencing face data is not possible.
     */
    hb_face_reference_blob: (face: number) => number

    /** Clears out the contents of a set. */
    hb_set_clear: (set: number) => void

    /** Adds `codepoint` to `set` */
    hb_set_add: (set: number, codepoint: number) => void

    /** Inverts the contents of `set` */
    hb_set_invert: (set: number) => void

    /** Creates a new subset input object */
    hb_subset_input_create_or_fail: () => number

    /** Decreases the reference count on `input`, and if it reaches zero, destroys `input`, freeing all memory. */
    hb_subset_input_destroy: (input: number) => void

    /** Gets the set of Unicode code points to retain, the caller should modify the set as needed. */
    hb_subset_input_unicode_set: (input: number) => number

    /** Gets the set of the specified type. */
    hb_subset_input_set: (input: number, set_type: number) => number

    /** Sets all of the flags in the input object to the values specified by the bit field. */
    hb_subset_input_set_flags: (input: number, value: number) => void

    /**
     * Pin an axis to its default location in the given subset input object.
     * Currently only works for fonts with 'glyf' tables. CFF and CFF2 is not yet supported.
     * Additionally all axes in a font must be pinned.
     */
    hb_subset_input_pin_axis_to_default: (input: number, face: number, axis_tag: number) => number

    /**
     * Pin an axis to a fixed location in the given subset input object.
     * Currently only works for fonts with 'glyf' tables. CFF and CFF2 is not yet supported.
     * Additionally all axes in a font must be pinned.
     */
    hb_subset_input_pin_axis_location: (input: number, face: number, axis_tag: number, axis_value: number) => boolean

    /** Subsets a font according to provided input. Returns nullptr if the subset operation fails. */
    hb_subset_or_fail: (source: number, input: number) => number
}

const harfbuzz: {
    hb: () => Promise<HarfbuzzSubset>
    readonly heapu8: Uint8Array
} = (() => {
    let hb: HarfbuzzSubset | null = null,
        heapu8: Uint8Array = new Uint8Array();
    return {
        async hb() {
            if (!hb) {
                const wasmSource = await fs.readFile(path.resolve(__dirname, '../../wasm/hb-subset.wasm'));
                ({ instance: { exports: hb } } = await WebAssembly.instantiate<HarfbuzzSubset>(wasmSource, {
                    env: {
                        emscripten_notify_memory_growth: () => {
                            heapu8 = new Uint8Array(hb!.memory.buffer);
                        },
                    },
                }));
                heapu8 = new Uint8Array(hb.memory.buffer);
            }
            return hb;
        },
        get heapu8(): Uint8Array {
            return heapu8;
        },
    };
})();

function* cpIterator(chars: string): IterableIterator<number> {
    for (const c of chars) {
        yield c.codePointAt(0)!;
    }
}

function hb_tag(tag: string): number {
    return ((tag.charCodeAt(0) & 0xFF) << 24)
        | ((tag.charCodeAt(1) & 0xFF) << 16)
        | ((tag.charCodeAt(2) & 0xFF) << 8)
        | ((tag.charCodeAt(3) & 0xFF) << 0);
}

export async function subsetFontFile(
    { fvar, ...font }: Pick<SystemFontData, 'src' | 'fvar' | 'ttcSubfont'>,
    coverage: string,
): Promise<Buffer | null> {
    // read the original font file
    const originalFont = await getFontBuffer(font);
    if (!originalFont) return null;
    // get harfbuzz webassembly exports
    const hb = await harfbuzz.hb(),
        input = hb.hb_subset_input_create_or_fail();
    if (input === 0) {
        throw new Error('hb_subset_input_create_or_fail (harfbuzz) returned zero, indicating failure');
    }
    // allocate space for the original font file
    const fontBuffer = hb.malloc(originalFont.byteLength);
    // copy the original font to the harfbuzz memory array
    harfbuzz.heapu8.set(new Uint8Array(originalFont), fontBuffer);
    // Create the face
    const blob = hb.hb_blob_create(fontBuffer, originalFont.byteLength, 2, 0, 0),
        face = hb.hb_face_create(blob, 0);
    hb.hb_blob_destroy(blob);
    // set input flags
    hb.hb_subset_input_set_flags(input, 1 /* HB_SUBSET_FLAGS_NO_HINTING  */);
    // pin axes to specific variation if this is a variable font
    if (fvar) {
        for (const [tag, value] of fvar) {
            hb.hb_subset_input_pin_axis_location(input, face, hb_tag(tag), value);
        }
    }
    // Do the equivalent of --font-features=*
    const layoutFeatures = hb.hb_subset_input_set(input, 6 /* HB_SUBSET_SETS_LAYOUT_FEATURE_TAG */);
    hb.hb_set_clear(layoutFeatures);
    hb.hb_set_invert(layoutFeatures);
    // Add unicodes indices
    const inputUnicodes = hb.hb_subset_input_unicode_set(input);
    for (const cp of cpIterator(coverage)) hb.hb_set_add(inputUnicodes, cp);
    let subset;
    try {
        subset = hb.hb_subset_or_fail(face, input);
        if (subset === 0) {
            hb.hb_face_destroy(face);
            hb.free(fontBuffer);
            return null;
        }
    } finally {
        // clean up
        hb.hb_subset_input_destroy(input);
    }
    // Get result blob
    const result = hb.hb_face_reference_blob(subset),
        offset = hb.hb_blob_get_data(result, 0),
        subsetByteLength = hb.hb_blob_get_length(result);
    if (subsetByteLength === 0) {
        hb.hb_blob_destroy(result);
        hb.hb_face_destroy(subset);
        hb.hb_face_destroy(face);
        hb.free(fontBuffer);
        return null;
    }
    const subsetFont = Buffer.from(harfbuzz.heapu8.subarray(offset, offset + subsetByteLength));
    hb.hb_blob_destroy(result);
    hb.hb_face_destroy(subset);
    hb.hb_face_destroy(face);
    hb.free(fontBuffer);
    return subsetFont;
}