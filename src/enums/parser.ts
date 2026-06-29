/**
 * Represents a single input file in the AST.
 * The input file is mandatory and must be specified at the top of the script.
 */
enum VideoCodec {
    H264 = 'h264',
    H265 = 'h265',
    VP8 = 'vp8',
    VP9 = 'vp9',
    AV1 = 'av1',
    MPEG2VIDEO = 'mpeg2video',
    THEORA = 'theora',
}

/**
 * Represents a single output file in the AST.
 * Each output can have its own configuration block, which overrides global settings.
 */
enum AudioCodec {
    AAC = 'aac',
    MP3 = 'mp3',
    OPUS = 'opus',
    VORBIS = 'vorbis',
    FLAC = 'flac',
    PCM = 'pcm_s16le',
    AC3 = 'ac3',
}

/**
 * Represents the position of a watermark on the video.
 * The watermark can be placed in one of four corners of the video frame.
 */
enum WatermarkPosition {
    TOP_LEFT = 'top-left',
    TOP_RIGHT = 'top-right',
    BOTTOM_LEFT = 'bottom-left',
    BOTTOM_RIGHT = 'bottom-right',
}

/**
 * Represents the unit of measurement for normalization.
 */
enum NormalizeUnit {
    LUFS = 'lufs', 
    dBTP = 'dbtp', 
    dBRMS = 'dbrms'
}

/**
 * Represents the type of reverb effect to apply to the audio.
 */
enum Reverb {
    SUBTLE = 'subtle',
    MEDIUM = 'medium',
    LARGE = 'large'
}

/**
 * Represents the audio channel configuration for the output.
 */
enum AudioChannel {
    STEREO = 'stereo',
    MONO = 'mono'
}

export { VideoCodec, AudioCodec, WatermarkPosition, NormalizeUnit, Reverb, AudioChannel };