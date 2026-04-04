package ch.kopolinfo.mailprocessor.backend.nativehost

import java.io.InputStream
import java.io.OutputStream

fun interface NativeMessageHandler {
    fun handle(rawMessage: String): String
}

class NativeMessagingHost(
    private val handler: NativeMessageHandler,
    private val codec: NativeMessagingCodec = NativeMessagingCodec(),
) {
    fun run(
        input: InputStream = System.`in`,
        output: OutputStream = System.out,
    ) {
        while (true) {
            val rawMessage = codec.readMessage(input) ?: return

            try {
                codec.writeMessage(output, handler.handle(rawMessage))
            } catch (exception: Exception) {
                System.err.println("Failed to handle native message: ${exception.message}")
            }
        }
    }
}
