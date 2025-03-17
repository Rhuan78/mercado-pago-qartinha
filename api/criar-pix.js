import axios from "axios";
import { v4 as uuidv4 } from "uuid";

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  // Adiciona suporte a CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Trata requisições OPTIONS (pré-flight)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { amount, description, email, cpf } = req.body;

    if (!amount || !email || !cpf) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const idempotencyKey = uuidv4();

    // Faz a requisição para criar o pagamento PIX no Mercado Pago
    const mercadoPagoResponse = await axios.post(
      "https://api.mercadopago.com/v1/payments",
      {
        transaction_amount: amount,
        description,
        payment_method_id: "pix",
        payer: {
          email,
          identification: {
            type: "CPF",
            number: cpf,
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
      }
    );

    const { id, point_of_interaction } = mercadoPagoResponse.data;

    // Verifica se o QR Code foi retornado
    const qrCode = point_of_interaction?.transaction_data?.qr_code || null;
    const qrCodeBase64 = point_of_interaction?.transaction_data?.qr_code_base64 || null;
    const ticketUrl = point_of_interaction?.transaction_data?.ticket_url || null;

    // Log para depuração
    console.log("Pagamento PIX gerado:", {
      id,
      qrCode,
      qrCodeBase64,
      ticketUrl,
    });

    // Se não houver QR Code, retorna erro
    if (!qrCode || !qrCodeBase64) {
      console.error("Erro: QR Code não retornado pelo Mercado Pago.");
      return res.status(500).json({
        error: "Erro ao gerar pagamento PIX",
        details: "QR Code não foi retornado pela API do Mercado Pago.",
      });
    }

    return res.status(200).json({ id, qrCode, qrCodeBase64, ticketUrl });
  } catch (error) {
    console.error("Erro ao gerar PIX:", error.response ? error.response.data : error.message);
    return res.status(500).json({
      error: "Erro ao gerar pagamento PIX",
      details: error.response ? error.response.data : error.message,
    });
  }
}
