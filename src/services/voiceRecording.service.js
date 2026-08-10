'use strict';

/* __AUTOATENDE_VOICE_BACKEND_PHASE4B1__ */

const fs = require('fs');
const path = require('path');
const {
  spawn
} = require('child_process');

const MAX_VOICE_BYTES =
  16 * 1024 * 1024;

const FFMPEG_TIMEOUT_MS =
  Number(
    process.env.VOICE_FFMPEG_TIMEOUT_MS ||
    120000
  );

function createVoiceError(
  message,
  statusCode,
  code,
  details = null
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.status = statusCode;
  error.code = code;

  if (details) {
    error.details = details;
  }

  return error;
}

function normalizeMime(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .split(';')[0]
    .trim();
}

function runProcess(
  command,
  args,
  {
    timeoutMs = FFMPEG_TIMEOUT_MS,
    captureStdout = false
  } = {}
) {
  return new Promise(
    (resolve, reject) => {
      const child = spawn(
        command,
        args,
        {
          stdio: [
            'ignore',
            captureStdout
              ? 'pipe'
              : 'ignore',
            'pipe'
          ]
        }
      );

      let stdout = '';
      let stderr = '';
      let settled = false;

      const timer = setTimeout(
        () => {
          if (settled) {
            return;
          }

          settled = true;

          child.kill('SIGKILL');

          reject(
            createVoiceError(
              'A normalização do áudio excedeu o tempo permitido.',
              504,
              'VOICE_TRANSCODE_TIMEOUT'
            )
          );
        },
        timeoutMs
      );

      if (child.stdout) {
        child.stdout.on(
          'data',
          (chunk) => {
            stdout += String(chunk);
          }
        );
      }

      child.stderr.on(
        'data',
        (chunk) => {
          stderr += String(chunk);
        }
      );

      child.on(
        'error',
        (error) => {
          if (settled) {
            return;
          }

          settled = true;
          clearTimeout(timer);

          reject(
            createVoiceError(
              'FFmpeg não está disponível no servidor.',
              503,
              'VOICE_FFMPEG_UNAVAILABLE',
              {
                message:
                  error?.message || null
              }
            )
          );
        }
      );

      child.on(
        'close',
        (exitCode) => {
          if (settled) {
            return;
          }

          settled = true;
          clearTimeout(timer);

          if (exitCode !== 0) {
            reject(
              createVoiceError(
                'Não foi possível processar a gravação de voz.',
                422,
                'VOICE_TRANSCODE_FAILED',
                {
                  exit_code: exitCode,
                  stderr:
                    stderr
                      .trim()
                      .slice(0, 3000)
                }
              )
            );

            return;
          }

          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim()
          });
        }
      );
    }
  );
}

async function probeVoiceFile(
  filePath
) {
  const result = await runProcess(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'a:0',
      '-show_entries',
      'stream=codec_name:format=duration',
      '-of',
      'json',
      filePath
    ],
    {
      timeoutMs: 30000,
      captureStdout: true
    }
  );

  let payload;

  try {
    payload = JSON.parse(
      result.stdout || '{}'
    );
  } catch (error) {
    throw createVoiceError(
      'FFprobe retornou uma resposta inválida.',
      422,
      'VOICE_PROBE_INVALID',
      {
        output:
          result.stdout
            .slice(0, 1000)
      }
    );
  }

  const stream =
    Array.isArray(payload?.streams)
      ? payload.streams[0]
      : null;

  const codec =
    String(
      stream?.codec_name || ''
    )
      .trim()
      .toLowerCase();

  const durationSeconds =
    Number(
      payload?.format?.duration ||
      0
    );

  return {
    codec,
    durationSeconds:
      Number.isFinite(durationSeconds)
        ? Math.max(
            0,
            Math.round(
              durationSeconds * 10
            ) / 10
          )
        : null
  };
}

async function cleanupVoiceFile(
  file
) {
  const filePath =
    typeof file === 'string'
      ? file
      : file?.path;

  if (!filePath) {
    return;
  }

  try {
    await fs.promises.unlink(
      filePath
    );
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.warn(
        '[VOICE_RECORDING] cleanup warning:',
        error?.message || error
      );
    }
  }
}

async function normalizeVoiceRecording(
  file
) {
  if (
    !file?.path ||
    !Number.isFinite(
      Number(file.size)
    )
  ) {
    throw createVoiceError(
      'Gravação de voz ausente ou inválida.',
      400,
      'VOICE_FILE_REQUIRED'
    );
  }

  const inputSize =
    Number(file.size);

  if (
    inputSize <= 0 ||
    inputSize > MAX_VOICE_BYTES
  ) {
    throw createVoiceError(
      'A gravação excede o limite permitido de 16 MB.',
      413,
      'VOICE_FILE_TOO_LARGE',
      {
        file_size: inputSize,
        max_size:
          MAX_VOICE_BYTES
      }
    );
  }

  const inputMime =
    normalizeMime(
      file.mimetype
    );

  const acceptedInputMimes =
    new Set([
      'audio/webm',
      'audio/ogg',
      'audio/mp4',
      'audio/mpeg',
      'audio/aac',
      'audio/amr'
    ]);

  if (
    !acceptedInputMimes.has(
      inputMime
    )
  ) {
    throw createVoiceError(
      'Formato de gravação não suportado.',
      415,
      'VOICE_INPUT_TYPE_NOT_ALLOWED',
      {
        mime_type: inputMime
      }
    );
  }

  const outputPath =
    path.join(
      path.dirname(file.path),
      `${
        path.basename(
          file.path,
          path.extname(file.path)
        )
      }.voice.ogg`
    );

  await cleanupVoiceFile(
    outputPath
  );

  try {
    await runProcess(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        file.path,
        '-map_metadata',
        '-1',
        '-vn',
        '-ac',
        '1',
        '-ar',
        '48000',
        '-c:a',
        'libopus',
        '-b:a',
        '32k',
        '-vbr',
        'on',
        '-compression_level',
        '10',
        '-application',
        'voip',
        '-f',
        'ogg',
        outputPath
      ]
    );

    const stat =
      await fs.promises.stat(
        outputPath
      );

    if (
      !stat.isFile() ||
      stat.size <= 0
    ) {
      throw createVoiceError(
        'FFmpeg não gerou um arquivo de voz válido.',
        422,
        'VOICE_OUTPUT_EMPTY'
      );
    }

    if (
      stat.size >
      MAX_VOICE_BYTES
    ) {
      throw createVoiceError(
        'A gravação processada excede 16 MB.',
        413,
        'VOICE_OUTPUT_TOO_LARGE',
        {
          file_size: stat.size,
          max_size:
            MAX_VOICE_BYTES
        }
      );
    }

    const probe =
      await probeVoiceFile(
        outputPath
      );

    if (probe.codec !== 'opus') {
      throw createVoiceError(
        'A gravação processada não está no codec Opus.',
        422,
        'VOICE_OUTPUT_CODEC_INVALID',
        {
          codec: probe.codec
        }
      );
    }

    return {
      fieldname:
        file.fieldname || 'file',

      originalname:
        `mensagem-de-voz-${Date.now()}.ogg`,

      encoding:
        file.encoding || '7bit',

      mimetype:
        'audio/ogg',

      destination:
        path.dirname(outputPath),

      filename:
        path.basename(outputPath),

      path:
        outputPath,

      size:
        stat.size,

      durationSeconds:
        probe.durationSeconds,

      sourceMimeType:
        inputMime,

      voiceRecording:
        true
    };
  } catch (error) {
    await cleanupVoiceFile(
      outputPath
    );

    throw error;
  }
}

module.exports = {
  MAX_VOICE_BYTES,
  normalizeMime,
  probeVoiceFile,
  normalizeVoiceRecording,
  cleanupVoiceFile
};
