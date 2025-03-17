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

    const { id, point_of_interaction } = mercadoPagoResponse.data;

    const qrCode = point_of_interaction.transaction_data.qr_code;
    const qrCodeBase64 = point_of_interaction.transaction_data.qr_code_base64;

    return res.status(200).json({ id, qrCode, qrCodeBase64 });

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

    

    return res.status(200).json(mercadoPagoResponse.data);
  } catch (error) {
    console.error("Erro ao gerar PIX:", error.response ? error.response.data : error.message);
    return res.status(500).json({
      error: "Erro ao gerar pagamento PIX",
      details: error.response ? error.response.data : error.message,
    });
  }
}
