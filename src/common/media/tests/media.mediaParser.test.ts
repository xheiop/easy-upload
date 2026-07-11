import { vi, expect, describe, it } from 'vitest';
import { BDInfoParser, MediaInfoParser } from '../media.mediaParser';

vi.mock('../index', { spy: true });
vi.mock('@/common/utils', { spy: true });

describe('BDInfoParser', () => {
  it('should parse quickSummary BDInfo correctly', () => {
    const source = `Disc Label: Anora.2024.1080p.FRA.Blu-ray.AVC.DTS-HD.MA.5.1
Disc Size: 47,576,622,216 bytes
Protection: AACS
Playlist: 00000.MPLS
Size: 44,096,403,456 bytes
Length: 2:18:47.000
Total Bitrate: 42.36 Mbps
Video: MPEG-4 AVC Video / 32877 kbps / 1080p / 24 fps / 16:9 / High Profile 4.1
Audio: French / DTS-HD Master Audio / 5.1 / 48 kHz / 3148 kbps / 24-bit (DTS Core: 5.1 / 48 kHz / 1509 kbps / 24-bit)
Audio: English / DTS-HD Master Audio / 5.1 / 48 kHz / 3144 kbps / 24-bit (DTS Core: 5.1 / 48 kHz / 1509 kbps / 24-bit)
Audio: French / DTS Audio / 2.0 / 48 kHz / 768 kbps / 16-bit
Subtitle: French / 4.467 kbps
Subtitle: German / 26.285 kbps
Subtitle: English / 35.278 kbps`;
    const mediaParser = new BDInfoParser(source);
    const result = mediaParser.parse();
    expect(result.duration).toBe(2 * 3600 + 18 * 60 + 47);
    expect(result.fileSize).toBe(47576622216);
    expect(result.fileName).toBe(
      'Anora.2024.1080p.FRA.Blu-ray.AVC.DTS-HD.MA.5.1',
    );
    expect(result.videoTracks).toHaveLength(1);
    expect(result.audioTracks).toHaveLength(3);
    expect(result.subtitleTracks).toHaveLength(3);
    expect(result.videoTracks[0].resolution).toBe('1080p');
    expect(result.videoTracks[0].codec).toBe('h264');
    expect(result.audioTracks[0].channelName).toBe('5.1');
    expect(result.audioTracks[0].language).toBe('French');
    expect(result.audioTracks[0].codec).toBe('dtshdma');
    expect(result.audioTracks[1].channelName).toBe('5.1');
    expect(result.audioTracks[1].language).toBe('English');
    expect(result.audioTracks[1].codec).toBe('dtshdma');
    expect(result.audioTracks[2].channelName).toBe('2.0');
    expect(result.audioTracks[2].language).toBe('French');
    expect(result.audioTracks[2].codec).toBe('dts');
    expect(result.subtitleTracks[0].language).toBe('French');
    expect(result.subtitleTracks[1].language).toBe('German');
    expect(result.subtitleTracks[2].language).toBe('English');
  });

  it('should parse raw BDInfo correctly', () => {
    const source = `DISC INFO:
    
    Disc Title: Wall-E - Ultra HD™
    Disc Label: WALL.E.2008.COMPLETE.UHD.BLURAY-AViATOR
    Disc Size: 64,831,109,301 bytes
    Protection: AACS2
    Extras: Ultra HD, BD-Java
    BDInfo: 0.7.5.5
    
    PLAYLIST REPORT:
    
    Name: 00800.MPLS
    Length: 1:38:12.594 (h:m:s.ms)
    Size: 44,503,998,912 bytes
    Total Bitrate: 60.42 Mbps
    
    VIDEO:
    
    Codec Bitrate Description
    ----- ------- -----------
    MPEG-H HEVC Video 41600 kbps 2160p / 23.976 fps / 16:9 / Main 10 @ Level 5.1 @ High / 10 bits / HDR10 / BT.2020
    
    AUDIO:
    
    Codec Language Bitrate Description
    ----- -------- ------- -----------
    Dolby TrueHD/Atmos Audio English 7879 kbps 7.1 / 48 kHz / 7239 kbps / 24-bit (AC3 Embedded: 5.1-EX / 48 kHz / 640 kbps / DN -27dB)
    DTS-HD Master Audio English 4144 kbps 5.1-ES / 48 kHz / 4144 kbps / 24-bit (DTS Core: 5.1-ES / 48 kHz / 1509 kbps / 24-bit)
    Dolby Digital EX Audio English 640 kbps 5.1-EX / 48 kHz / 640 kbps / DN -27dB
    Dolby Digital Audio English 320 kbps 2.0 / 48 kHz / 320 kbps / DN -27dB
    Dolby Digital Audio English 320 kbps 2.0 / 48 kHz / 320 kbps / DN -27dB
    Dolby Digital EX Audio French 640 kbps 5.1-EX / 48 kHz / 640 kbps / DN -31dB
    Dolby Digital EX Audio Spanish 640 kbps 5.1-EX / 48 kHz / 640 kbps / DN -31dB
    
    SUBTITLES:
    
    Codec Language Bitrate Description
    ----- -------- ------- -----------
    Presentation Graphics English 28.699 kbps
    Presentation Graphics French 11.777 kbps
    Presentation Graphics Spanish 11.718 kbps`;

    const mediaParser = new BDInfoParser(source);
    const result = mediaParser.parse();
    expect(result.duration).toBe(1 * 3600 + 38 * 60 + 12.594);
    expect(result.fileSize).toBe(64831109301);
    expect(result.fileName).toBe('WALL.E.2008.COMPLETE.UHD.BLURAY-AViATOR');
    expect(result.videoTracks).toHaveLength(1);
    expect(result.audioTracks).toHaveLength(7);
    expect(result.subtitleTracks).toHaveLength(3);
    expect(result.videoTracks[0].resolution).toBe('2160p');
    expect(result.videoTracks[0].codec).toBe('hevc');
    expect(result.videoTracks[0].hdrType).toBe('HDR10');
    expect(result.audioTracks[0].channelName).toBe('7.1');
    expect(result.audioTracks[0].language).toBe('English');
    expect(result.audioTracks[0].codec).toBe('atmos');
    expect(result.audioTracks[5].channelName).toBe('5.1');
    expect(result.audioTracks[5].language).toBe('French');
    expect(result.audioTracks[5].codec).toBe('dd');
    expect(result.subtitleTracks[0].language).toBe('English');
    expect(result.subtitleTracks[1].language).toBe('French');
    expect(result.subtitleTracks[2].language).toBe('Spanish');
  });
  it('should parse another qucikSummary BDInfo correctly', () => {
    const source = `Disc Title: MOANA 2 - Ultra HD™
    Disc Label: Moana 2 2024 UHD BluRay 2160p HEVC Atmos TrueHD7.1-MTeam
    Disc Size: 59,644,244,389 bytes
    Protection: AACS2
    Playlist: 00800.MPLS
    Size: 48,927,344,640 bytes
    Length: 1:39:42.017
    Total Bitrate: 65.43 Mbps
    Video: MPEG-H HEVC Video / 46966 kbps / 2160p / 23.976 fps / 16:9 / Main 10 @ Level 5.1 @ High / 10 bits / HDR10 / BT.2020
    * Video: MPEG-H HEVC Video / 4191 kbps / 1080p / 23.976 fps / 16:9 / Main 10 @ Level 5.1 @ High / 10 bits / Dolby Vision / BT.2020
    Audio: English / Dolby TrueHD/Atmos Audio / 7.1 / 48 kHz / 5001 kbps / 24-bit (AC3 Embedded: 5.1 / 48 kHz / 640 kbps / DN -27dB)
    Audio: English / Dolby Digital Audio / 2.0 / 48 kHz / 320 kbps / DN -27dB
    Audio: French / Dolby Digital Plus Audio / 7.1 / 48 kHz / 1024 kbps / DN -27dB (AC3 Embedded: 5.1 / 48 kHz / 576 kbps / DN -27dB)
    Audio: Spanish / Dolby Digital Plus Audio / 7.1 / 48 kHz / 1024 kbps / DN -27dB (AC3 Embedded: 5.1 / 48 kHz / 576 kbps / DN -27dB)
    Audio: Japanese / Dolby Digital Plus Audio / 7.1 / 48 kHz / 1024 kbps / DN -27dB (AC3 Embedded: 5.1 / 48 kHz / 576 kbps / DN -27dB)
    Audio: Japanese / Dolby Digital Audio / 2.0 / 48 kHz / 320 kbps / DN -24dB
    Subtitle: English / 44.971 kbps
    Subtitle: French / 35.721 kbps
    Subtitle: Spanish / 33.557 kbps
    Subtitle: Japanese / 22.860 kbps
    Subtitle: French / 1.705 kbps
    * Subtitle: English / 493.602 kbps
    * Subtitle: French / 50.745 kbps
    * Subtitle: Spanish / 41.642 kbps
    * Subtitle: Japanese / 55.077 kbps`;

    const mediaParser = new BDInfoParser(source);
    const result = mediaParser.parse();
    expect(result.duration).toBe(1 * 3600 + 39 * 60 + 42.017);
    expect(result.fileSize).toBe(59644244389);
    expect(result.fileName).toBe(
      'Moana 2 2024 UHD BluRay 2160p HEVC Atmos TrueHD7.1-MTeam',
    );
    expect(result.videoTracks).toHaveLength(2);
    expect(result.audioTracks).toHaveLength(6);
    expect(result.subtitleTracks).toHaveLength(9);
    expect(result.videoTracks[0].resolution).toBe('2160p');
    expect(result.videoTracks[0].codec).toBe('hevc');
    expect(result.videoTracks[0].hdrType).toBe('HDR10');
    expect(result.videoTracks[1].resolution).toBe('1080p');
    expect(result.videoTracks[1].codec).toBe('hevc');
    expect(result.videoTracks[1].hdrType).toBe('DV');
    expect(result.audioTracks[0].channelName).toBe('7.1');
    expect(result.audioTracks[0].language).toBe('English');
    expect(result.audioTracks[0].codec).toBe('atmos');
    expect(result.audioTracks[4].channelName).toBe('7.1');
    expect(result.audioTracks[4].language).toBe('Japanese');
    expect(result.audioTracks[4].codec).toBe('dd+');
    expect(result.subtitleTracks[0].language).toBe('English');
    expect(result.subtitleTracks[7].language).toBe('Spanish');
  });

  it('should handle empty or invalid BDInfo', () => {
    const expected = {
      fileName: '',
      fileSize: 0,
      duration: 0,
      format: '',
      audioTracks: [],
      subtitleTracks: [],
      videoTracks: [],
    };
    expect(new BDInfoParser('').parse()).toEqual(expected);
    expect(new BDInfoParser('invalid BDInfo').parse()).toEqual(expected);
  });
});

describe('MediaInfoParser', () => {
  it('should parse MediaInfo correctly', () => {
    const source = `General
Unique ID : 282620947024003389347898311117810347460 (0xD49ED081A90FE8517E9E5E44538AADC4)
Complete name : A.Complete.Unknown.2024.2160p.WEB-DL.DDP5.1.Atmos.DV.H.265-STRUGGLER.mkv
Format : Matroska
Format version : Version 4
File size : 25.1 GiB
Duration : 2 h 20 min
Overall bit rate : 25.5 Mb/s
Frame rate : 24.000 FPS
Writing application : mkvmerge v90.0 ('Hanging On') 64-bit
Writing library : libebml v1.4.5 + libmatroska v1.7.1

Video
ID : 1
Format : HEVC
Format/Info : High Efficiency Video Coding
Format profile : Main 10@L5@High
HDR format : Dolby Vision, Version 1.0, Profile 5, dvhe.05.06, BL+RPU, no metadata compression
Codec ID : V_MPEGH/ISO/HEVC
Duration : 2 h 20 min
Bit rate : 24.8 Mb/s
Width : 3 840 pixels
Height : 1 604 pixels
Display aspect ratio : 2.39:1
Frame rate mode : Constant
Frame rate : 24.000 FPS
Color space : YUV
Chroma subsampling : 4:2:0
Bit depth : 10 bits
Bits/(Pixel*Frame) : 0.168
Stream size : 24.4 GiB (97%)
Language : English
Default : Yes
Forced : No

Audio
ID : 2
Format : E-AC-3 JOC
Format/Info : Enhanced AC-3 with Joint Object Coding
Commercial name : Dolby Digital Plus with Dolby Atmos
Codec ID : A_EAC3
Duration : 2 h 20 min
Bit rate mode : Constant
Bit rate : 768 kb/s
Channel(s) : 6 channels
Channel layout : L R C LFE Ls Rs
Sampling rate : 48.0 kHz
Frame rate : 31.250 FPS (1536 SPF)
Compression mode : Lossy
Stream size : 773 MiB (3%)
Language : English
Service kind : Complete Main
Default : Yes
Forced : No
Complexity index : 16
Number of dynamic objects : 15
Bed channel count : 1 channel
Bed channel configuration : LFE
Dialog Normalization : -27 dB
compr : -0.28 dB
dialnorm_Average : -27 dB
dialnorm_Minimum : -27 dB
dialnorm_Maximum : -27 dB

Text #1
ID : 3
Format : UTF-8
Codec ID : S_TEXT/UTF8
Codec ID/Info : UTF-8 Plain Text
Duration : 2 h 10 min
Bit rate : 70 b/s
Frame rate : 0.270 FPS
Count of elements : 2117
Stream size : 67.3 KiB (0%)
Language : English (US)
Default : No
Forced : No

Text #2
ID : 4
Format : UTF-8
Codec ID : S_TEXT/UTF8
Codec ID/Info : UTF-8 Plain Text
Duration : 2 h 20 min
Bit rate : 73 b/s
Frame rate : 0.279 FPS
Count of elements : 2352
Stream size : 75.7 KiB (0%)
Title : SDH
Language : English (US)
Default : No
Forced : No

Text #3
ID : 5
Format : UTF-8
Codec ID : S_TEXT/UTF8
Codec ID/Info : UTF-8 Plain Text
Duration : 2 h 12 min
Bit rate : 64 b/s
Frame rate : 0.246 FPS
Count of elements : 1961
Stream size : 62.5 KiB (0%)
Language : English
Default : Yes
Forced : No

Text #4
ID : 6
Format : UTF-8
Codec ID : S_TEXT/UTF8
Codec ID/Info : UTF-8 Plain Text
Duration : 2 h 13 min
Bit rate : 57 b/s
Frame rate : 0.245 FPS
Count of elements : 1967
Stream size : 56.8 KiB (0%)
Title : Spanish (Latin America)
Language : Spanish (Latin America)
Default : No
Forced : No

Text #5
ID : 7
Format : UTF-8
Codec ID : S_TEXT/UTF8
Codec ID/Info : UTF-8 Plain Text
Duration : 2 h 20 min
Bit rate : 63 b/s
Frame rate : 0.239 FPS
Count of elements : 2019
Stream size : 64.9 KiB (0%)
Title : French (Canada)
Language : French (CA)
Default : No
Forced : No

Menu
00:00:00.000 : en:Chapter 01
00:04:59.507 : en:Chapter 02
00:12:05.725 : en:Chapter 03
00:17:25.003 : en:Chapter 04
00:24:50.657 : en:Chapter 05
00:35:07.023 : en:Chapter 06
00:51:19.371 : en:Chapter 07
01:01:26.144 : en:Chapter 08
01:10:10.377 : en:Chapter 09
01:21:54.581 : en:Chapter 10
01:34:28.835 : en:Chapter 11
01:49:59.641 : en:Chapter 12
01:56:34.869 : en:Chapter 13
02:11:10.120 : en:Chapter 14
02:13:21.167 : en:Chapter 15`;
    const mediaParser = new MediaInfoParser(source);
    const result = mediaParser.parse();
    expect(result.duration).toBe(2 * 3600 + 20 * 60);
    expect(result.fileSize).toBe(25.1 * 1024 ** 3);
    expect(result.fileName).toBe(
      'A.Complete.Unknown.2024.2160p.WEB-DL.DDP5.1.Atmos.DV.H.265-STRUGGLER.mkv',
    );
    expect(result.format).toBe('Matroska');
    expect(result.videoTracks).toHaveLength(1);
    expect(result.audioTracks).toHaveLength(1);
    expect(result.subtitleTracks).toHaveLength(5);
    expect(result.videoTracks[0].resolution).toBe('2160p');
    expect(result.videoTracks[0].codec).toBe('hevc');
    expect(result.videoTracks[0].hdrType).toBe('DV');
    expect(result.videoTracks[0].isEncoded).toBe(false);
    expect(result.videoTracks[0].default).toBe(true);
    expect(result.videoTracks[0].forced).toBe(false);
    expect(result.videoTracks[0].id).toBe('1');
    expect(result.audioTracks[0].channelName).toBe('5.1');
    expect(result.audioTracks[0].language).toBe('English');
    expect(result.audioTracks[0].codec).toBe('dd+');
    expect(result.subtitleTracks[0].language).toBe('English (US)');
    expect(result.subtitleTracks[0].forced).toBe(false);
    expect(result.subtitleTracks[0].default).toBe(false);
    expect(result.subtitleTracks[1].language).toBe('English (US)');
    expect(result.subtitleTracks[1].title).toBe('SDH');
    expect(result.subtitleTracks[2].language).toBe('English');
    expect(result.subtitleTracks[3].language).toBe('Spanish (Latin America)');
    expect(result.subtitleTracks[4].language).toBe('French (CA)');
    expect(result.subtitleTracks[4].id).toBe('7');
  });

  it('should handle the case for sdr 1080p aac without subtitle', () => {
    const source = `General
Unique ID : 7945811609608179089303869094252258772 (0x5FA4EC239A2A7024AC378D9B0C425D4)
Complete name : Setting Sun.2160p.WEB-DL.AAC2.H264.mkv
Format : Matroska
Format version : Version 4
File size : 14.0 GiB
Duration : 3 h 14 min
Overall bit rate : 10.3 Mb/s
Encoded date : UTC 2023-10-25 09:19:50
Writing application : mkvmerge v55.0.0 ('Waiting For Space') 64-bit
Writing library : libebml v1.4.2 + libmatroska v1.6.4

Video
ID : 1
Format : AVC
Format/Info : Advanced Video Codec
Format profile : Main@L5.2
Format settings : CABAC / 4 Ref Frames
Format settings, CABAC : Yes
Format settings, Reference frames : 4 frames
Codec ID : V_MPEG4/ISO/AVC
Duration : 3 h 14 min
Bit rate : 9 975 kb/s
Width : 3 840 pixels
Height : 2 160 pixels
Display aspect ratio : 16:9
Frame rate mode : Constant
Frame rate : 59.940 (60000/1001) FPS
Color space : YUV
Chroma subsampling : 4:2:0
Bit depth : 8 bits
Scan type : Progressive
Bits/(Pixel*Frame) : 0.020
Stream size : 13.5 GiB (97%)
Language : Chinese
Default : Yes
Forced : No
Color range : Limited
Color primaries : BT.709
Transfer characteristics : BT.709
Matrix coefficients : BT.709

Audio
ID : 2
Format : AAC LC
Format/Info : Advanced Audio Codec Low Complexity
Codec ID : A_AAC-2
Duration : 3 h 14 min
Bit rate : 318 kb/s
Channel(s) : 2 channels
Channel layout : L R
Sampling rate : 44.1 kHz
Frame rate : 43.066 FPS (1024 SPF)
Compression mode : Lossy
Stream size : 441 MiB (3%)
Language : Chinese
Default : Yes
Forced : No`;
    const mediaParser = new MediaInfoParser(source);
    const result = mediaParser.parse();
    expect(result.duration).toBe(3 * 3600 + 14 * 60);
    expect(result.fileSize).toBe(14.0 * 1024 ** 3);
    expect(result.fileName).toBe('Setting Sun.2160p.WEB-DL.AAC2.H264.mkv');
    expect(result.format).toBe('Matroska');
    expect(result.videoTracks).toHaveLength(1);
    expect(result.audioTracks).toHaveLength(1);
    expect(result.subtitleTracks).toHaveLength(0);
    expect(result.videoTracks[0].resolution).toBe('2160p');
    expect(result.videoTracks[0].codec).toBe('h264');
    expect(result.videoTracks[0].isEncoded).toBe(false);
    expect(result.videoTracks[0].default).toBe(true);
    expect(result.videoTracks[0].forced).toBe(false);
    expect(result.videoTracks[0].id).toBe('1');
    expect(result.videoTracks[0].hdrType).toBe('');
    expect(result.audioTracks[0].channelName).toBe('2.0');
    expect(result.audioTracks[0].language).toBe('Chinese');
    expect(result.audioTracks[0].codec).toBe('aac');
  });

  it('should handle the case for multiple audios', () => {
    const source = `General
Unique ID : 117484897063470276188677493949731804386 (0x5862C4A3F4E2BECFB8ADB4B0432D94E2)
Complete name : Shao.Lin.Ying.Xiong.Bang.AKA.Shaolin.Abbot.AKA.Abbot.Of.Shaolin.AKA.A.Slice.Of.Death.1979.720p.BluRay.FLAC.2.0.x264-ZAL.mkv
Format : Matroska
Format version : Version 4
File size : 4.19 GiB
Duration : 1 h 22 min
Overall bit rate mode : Variable
Overall bit rate : 7 233 kb/s
Frame rate : 23.976 FPS
Movie name : Shao Lin ying xiong bang AKA Shaolin Abbot AKA Abbot of Shaolin AKA A Slice of Death [1979] 720p BluRay
Encoded date : 2025-03-17 08:57:32 UTC
Writing application : mkvmerge v81.0 ('Milliontown') 64-bit
Writing library : libebml v1.4.4 + libmatroska v1.7.1

Video
ID : 1
Format : AVC
Format/Info : Advanced Video Codec
Format profile : High@L4.1
Format settings : CABAC / 12 Ref Frames
Format settings, CABAC : Yes
Format settings, Reference frames : 12 frames
Codec ID : V_MPEG4/ISO/AVC
Duration : 1 h 22 min
Bit rate : 6 612 kb/s
Width : 1 280 pixels
Height : 542 pixels
Display aspect ratio : 2.35:1
Frame rate mode : Constant
Frame rate : 23.976 (24000/1001) FPS
Color space : YUV
Chroma subsampling : 4:2:0
Bit depth : 8 bits
Scan type : Progressive
Bits/(Pixel*Frame) : 0.398
Stream size : 3.83 GiB (91%)
Writing library : x264 core 164
Encoding settings : cabac=1 / ref=12 / deblock=1:-3:-3 / analyse=0x3:0x133 / me=umh / subme=10 / psy=1 / psy_rd=1.00:0.00 / mixed_ref=1 / me_range=32 / chroma_me=1 / trellis=2 / 8x8dct=1 / cqm=0 / deadzone=21,11 / fast_pskip=0 / chroma_qp_offset=-2 / threads=12 / lookahead_threads=3 / sliced_threads=0 / nr=0 / decimate=0 / interlaced=0 / bluray_compat=0 / constrained_intra=0 / bframes=16 / b_pyramid=2 / b_adapt=2 / b_bias=0 / direct=3 / weightb=1 / open_gop=0 / weightp=2 / keyint=240 / keyint_min=24 / scenecut=40 / intra_refresh=0 / rc_lookahead=60 / rc=crf / mbtree=0 / crf=15.0 / qcomp=0.60 / qpmin=0 / qpmax=69 / qpstep=4 / vbv_maxrate=62500 / vbv_bufsize=78125 / crf_max=0.0 / nal_hrd=none / filler=0 / ip_ratio=1.40 / pb_ratio=1.30 / aq=2:1.00
Default : Yes
Forced : No
Color range : Limited
Color primaries : BT.709
Transfer characteristics : BT.709
Matrix coefficients : BT.709

Audio #1
ID : 2
Format : FLAC
Format/Info : Free Lossless Audio Codec
Codec ID : A_FLAC
Duration : 1 h 22 min
Bit rate mode : Variable
Bit rate : 316 kb/s
Channel(s) : 2 channels
Channel layout : L R
Sampling rate : 48.0 kHz
Frame rate : 11.719 FPS (4096 SPF)
Bit depth : 16 bits
Compression mode : Lossless
Stream size : 188 MiB (4%)
Writing library : libFLAC 1.2.1 (2007-09-17)
Language : Chinese
Default : Yes
Forced : No
MD5 of the unencoded content : E68A1997121546A082E9D3B310823AB9

Audio #2
ID : 3
Format : FLAC
Format/Info : Free Lossless Audio Codec
Codec ID : A_FLAC
Duration : 1 h 22 min
Bit rate mode : Variable
Bit rate : 224 kb/s
Channel(s) : 2 channels
Channel layout : L R
Sampling rate : 48.0 kHz
Frame rate : 11.719 FPS (4096 SPF)
Bit depth : 16 bits
Compression mode : Lossless
Stream size : 133 MiB (3%)
Writing library : libFLAC 1.2.1 (2007-09-17)
Language : English
Default : No
Forced : No
MD5 of the unencoded content : EB9E8ED68D11391590AB045DE2701792

Audio #3
ID : 4
Format : AAC LC
Format/Info : Advanced Audio Codec Low Complexity
Codec ID : A_AAC-2
Duration : 1 h 22 min
Bit rate : 77.1 kb/s
Channel(s) : 2 channels
Channel layout : L R
Sampling rate : 48.0 kHz
Frame rate : 46.875 FPS (1024 SPF)
Compression mode : Lossy
Stream size : 45.7 MiB (1%)
Title : Commentary by film critic James Mudge
Language : English
Default : No
Forced : No

Text #1
ID : 5
Format : UTF-8
Codec ID : S_TEXT/UTF8
Codec ID/Info : UTF-8 Plain Text
Duration : 1 h 22 min
Bit rate : 45 b/s
Frame rate : 0.178 FPS
Count of elements : 877
Stream size : 27.1 KiB (0%)
Language : English
Default : Yes
Forced : No

Text #2
ID : 6
Format : UTF-8
Codec ID : S_TEXT/UTF8
Codec ID/Info : UTF-8 Plain Text
Duration : 1 h 22 min
Bit rate : 48 b/s
Frame rate : 0.256 FPS
Count of elements : 1272
Stream size : 29.5 KiB (0%)
Title : English Dubtitles
Language : English
Default : No
Forced : No

Menu
00:00:00.000 : Chapter 1
00:09:42.791 : Chapter 2
00:23:59.939 : Chapter 3
00:36:03.244 : Chapter 4
00:46:53.436 : Chapter 5
00:56:48.196 : Chapter 6
01:07:15.949 : Chapter 7
01:14:32.343 : Chapter 8`;
    const mediaParser = new MediaInfoParser(source);
    const result = mediaParser.parse();
    expect(result.duration).toBe(1 * 3600 + 22 * 60);
    expect(result.fileSize).toBe(4.19 * 1024 ** 3);
    expect(result.fileName).toBe(
      'Shao.Lin.Ying.Xiong.Bang.AKA.Shaolin.Abbot.AKA.Abbot.Of.Shaolin.AKA.A.Slice.Of.Death.1979.720p.BluRay.FLAC.2.0.x264-ZAL.mkv',
    );
    expect(result.videoTracks).toHaveLength(1);
    expect(result.audioTracks).toHaveLength(3);
    expect(result.subtitleTracks).toHaveLength(2);
    expect(result.videoTracks[0].resolution).toBe('720p');
    expect(result.videoTracks[0].codec).toBe('x264');
    expect(result.videoTracks[0].isEncoded).toBe(true);
    expect(result.videoTracks[0].default).toBe(true);
    expect(result.audioTracks[0].channelName).toBe('2.0');
    expect(result.audioTracks[0].language).toBe('Chinese');
    expect(result.audioTracks[0].codec).toBe('flac');
    expect(result.audioTracks[0].default).toBe(true);
  });

  it('should handle the no audio case', () => {
    const source = `General
Unique ID : 117484897063470276188677493949731804386 (0x5862C4A3F4E2BECFB8ADB4B0432D94E2)
Complete name : Shao.Lin.Ying.Xiong.Bang.AKA.Shaolin.Abbot.AKA.Abbot.Of.Shaolin.AKA.A.Slice.Of.Death.1979.720p.BluRay.FLAC.2.0.x264-ZAL.mkv
Format : Matroska
Format version : Version 4
File size : 4.19 GiB
Duration : 1 h 22 min
Overall bit rate mode : Variable
Overall bit rate : 7 233 kb/s
Frame rate : 23.976 FPS
Movie name : Shao Lin ying xiong bang AKA Shaolin Abbot AKA Abbot of Shaolin AKA A Slice of Death [1979] 720p BluRay
Encoded date : 2025-03-17 08:57:32 UTC
Writing application : mkvmerge v81.0 ('Milliontown') 64-bit
Writing library : libebml v1.4.4 + libmatroska v1.7.1

Video
ID : 1
Format : AVC
Format/Info : Advanced Video Codec
Format profile : High@L4.1
Format settings : CABAC / 12 Ref Frames
Format settings, CABAC : Yes
Format settings, Reference frames : 12 frames
Codec ID : V_MPEG4/ISO/AVC
Duration : 1 h 22 min
Bit rate : 6 612 kb/s
Width : 1 280 pixels
Height : 542 pixels
Display aspect ratio : 2.35:1
Frame rate mode : Constant
Frame rate : 23.976 (24000/1001) FPS
Color space : YUV
Chroma subsampling : 4:2:0
Bit depth : 8 bits
Scan type : Progressive
Bits/(Pixel*Frame) : 0.398
Stream size : 3.83 GiB (91%)
Writing library : x264 core 164
Encoding settings : cabac=1 / ref=12 / deblock=1:-3:-3 / analyse=0x3:0x133 / me=umh / subme=10 / psy=1 / psy_rd=1.00:0.00 / mixed_ref=1 / me_range=32 / chroma_me=1 / trellis=2 / 8x8dct=1 / cqm=0 / deadzone=21,11 / fast_pskip=0 / chroma_qp_offset=-2 / threads=12 / lookahead_threads=3 / sliced_threads=0 / nr=0 / decimate=0 / interlaced=0 / bluray_compat=0 / constrained_intra=0 / bframes=16 / b_pyramid=2 / b_adapt=2 / b_bias=0 / direct=3 / weightb=1 / open_gop=0 / weightp=2 / keyint=240 / keyint_min=24 / scenecut=40 / intra_refresh=0 / rc_lookahead=60 / rc=crf / mbtree=0 / crf=15.0 / qcomp=0.60 / qpmin=0 / qpmax=69 / qpstep=4 / vbv_maxrate=62500 / vbv_bufsize=78125 / crf_max=0.0 / nal_hrd=none / filler=0 / ip_ratio=1.40 / pb_ratio=1.30 / aq=2:1.00
Default : Yes
Forced : No
Color range : Limited
Color primaries : BT.709
Transfer characteristics : BT.709
Matrix coefficients : BT.709`;
    const mediaParser = new MediaInfoParser(source);
    const result = mediaParser.parse();
    expect(result.duration).toBe(1 * 3600 + 22 * 60);
    expect(result.videoTracks).toHaveLength(1);
    expect(result.audioTracks).toHaveLength(0);
    expect(result.subtitleTracks).toHaveLength(0);
  });

  it('should handle empty or malformed source', () => {
    const mediaParser = new MediaInfoParser('');
    const result = mediaParser.parse();
    expect(result).toEqual({
      fileName: '',
      fileSize: 0,
      duration: 0,
      format: '',
      audioTracks: [],
      subtitleTracks: [],
      videoTracks: [],
    });

    const mediaParser1 = new MediaInfoParser('malformed');
    const result1 = mediaParser1.parse();
    expect(result1).toEqual({
      fileName: '',
      fileSize: 0,
      duration: 0,
      format: '',
      audioTracks: [],
      subtitleTracks: [],
      videoTracks: [],
    });
  });

  describe('MediaInfoParser.parseVideo', () => {
    it('mpeg2', () => {
      const source = `
        Video
        ID : 1
        Format : MPEG Video
        Format version : Version 2
        Format profile : Main@High
        Format settings : CustomMatrix / BVOP
        Format settings, BVOP : Yes
        Format settings, Matrix : Custom
        Format settings, GOP : M=3, N=15
        Format settings, picture structure : Frame
        Codec ID : V_MPEG2
        Codec ID/Info : MPEG 1 or 2 Video
        Duration : 1 h 24 min
        Bit rate mode : Variable
        Bit rate : 14.1 Mb/s
        Maximum bit rate : 24.0 Mb/s
        Width : 1 440 pixels
        Height : 1 080 pixels
        Display aspect ratio : 16:9
        Frame rate mode : Constant
        Frame rate : 29.970 (30000/1001) FPS
        Color space : YUV
        Chroma subsampling : 4:2:0
        Bit depth : 8 bits
        Scan type : Interlaced
        Scan order : Top Field First
        Compression mode : Lossy
        Bits/(Pixel*Frame) : 0.302
        Time code of first frame : 00:00:00:00
        Time code source : Group of pictures header
        GOP, Open/Closed : Open
        GOP, Open/Closed of first frame : Closed
        Stream size : 8.27 GiB (99%)
        Default : Yes
        Forced : No
        Color primaries : BT.709
        Transfer characteristics : BT.709
        Matrix coefficients : BT.709`;
      const mediaParser = new MediaInfoParser(source);
      const result = mediaParser.parse();
      expect(result.videoTracks).toHaveLength(1);
      expect(result.videoTracks[0].resolution).toBe('1080i');
      expect(result.videoTracks[0].codec).toBe('mpeg2');
    });

    it('xvid', () => {
      const source = `
      Video
      ID : 0
      Format : MPEG-4 Visual
      Format profile : Advanced Simple@L5
      Format settings : BVOP1
      Format settings, BVOP : 1
      Format settings, QPel : No
      Format settings, GMC : No warppoints
      Format settings, Matrix : Default (MPEG)
      Codec ID : XVID
      Codec ID/Hint : XviD
      Duration : 1 h 0 min
      Bit rate : 1 765 kb/s
      Width : 720 pixels
      Height : 576 pixels
      Display aspect ratio : 4:3
      Frame rate : 25.000 FPS
      Standard : PAL
      Color space : YUV
      Chroma subsampling : 4:2:0
      Bit depth : 8 bits
      Scan type : Progressive
      Compression mode : Lossy
      Bits/(Pixel*Frame) : 0.170
      Stream size : 769 MiB (90%)
      Writing library : XviD 64`;
      const mediaParser = new MediaInfoParser(source);
      const result = mediaParser.parse();
      expect(result.videoTracks).toHaveLength(1);
      expect(result.videoTracks[0].resolution).toBe('576p');
      expect(result.videoTracks[0].codec).toBe('xvid');
    });
  });
});

describe('MediaParser.getHdrType', () => {
  it('should return the correct HDR type', () => {
    const mediaParser = new BDInfoParser('');
    expect(mediaParser.getHdrType('HDR10')).toBe('HDR10');
    expect(mediaParser.getHdrType('Dolby Vision')).toBe('DV');
    expect(mediaParser.getHdrType('DolbyVision')).toBe('DV');
    expect(mediaParser.getHdrType('HDR10+')).toBe('HDR10+');
    expect(mediaParser.getHdrType('HLG')).toBe('HLG');
    expect(mediaParser.getHdrType('')).toBe('');
    expect(mediaParser.getHdrType('SDR')).toBe('');
  });
});

describe('MediaInfoParse.parseResolution', () => {
  it('should parse resolution correctly', () => {
    const mediaParser = new MediaInfoParser('');
    expect(mediaParser.parseResolution(7680, 4320)).toBe('4320p');
    expect(mediaParser.parseResolution(3840, 2160)).toBe('2160p');
    expect(mediaParser.parseResolution(1920, 1080)).toBe('1080p');
    expect(mediaParser.parseResolution(1920, 900)).toBe('1080p');
    expect(mediaParser.parseResolution(1920, 900, 'Interlaced')).toBe('1080i');
    expect(mediaParser.parseResolution(2560, 1440)).toBe('1080p');
    expect(mediaParser.parseResolution(1280, 720)).toBe('720p');
    expect(mediaParser.parseResolution(720, 480)).toBe('480p');
    expect(mediaParser.parseResolution(848, 480)).toBe('480p');
    expect(mediaParser.parseResolution(640, 360)).toBe('360p');
    expect(mediaParser.parseResolution(1024, 576)).toBe('576p');
    expect(mediaParser.parseResolution(420, 240)).toBe('240p');
    expect(mediaParser.parseResolution(200, 100)).toBe('200x100');
    expect(mediaParser.parseResolution(0, 0)).toBe('');
    expect(mediaParser.parseResolution(NaN, NaN)).toBe('');
  });
});

describe('MediaInfoParser.splitIntoSections with colons in values', () => {
  const source = [
    'General',
    'Complete name : Mission Impossible: Fallout.mkv',
    'Format : Matroska',
    'File size : 1.36 GiB',
    'Duration : 2 h 27 min',
    '',
    'Video',
    'Format : AVC',
    'Display aspect ratio : 2.39:1',
    'Width : 1 920 pixels',
    'Height : 800 pixels',
    '',
    'Audio',
    'Format : AC-3',
  ].join('\n');

  it('keeps the full value after the first colon', () => {
    const result = new MediaInfoParser(source).parse();
    expect(result.fileName).toBe('Mission Impossible: Fallout.mkv');
  });

  it('returns an empty channelName when Channel(s) is missing', () => {
    const result = new MediaInfoParser(source).parse();
    expect(result.audioTracks[0].channelName).toBe('');
  });
});
