package ch.kopolinfo.mailprocessor.backend.nativehost

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import kotlin.test.Test
import kotlin.test.assertEquals

class NativeMessagingCodecTest {
    private val codec = NativeMessagingCodec()

    @Test
    fun roundTripsSingleMessage() {
        val output = ByteArrayOutputStream()

        codec.writeMessage(output, """{"hello":"world"}""")

        val input = ByteArrayInputStream(output.toByteArray())
        val decoded = codec.readMessage(input)

        assertEquals("""{"hello":"world"}""", decoded)
    }
}
