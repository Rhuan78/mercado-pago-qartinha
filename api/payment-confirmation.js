import axios from "axios";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: true,
  },
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Função para enviar e-mail via Brevo
const sendEmailWithBrevo = async (toEmail) => {
  const emailData = {
    sender: {
      name: "Qartinha",
      email: "contato@qartinha.com.br",
    },
    replyTo: {
      name: "Qartinha",
      email: "contato@qartinha.com.br", // <- evita seu e-mail pessoal como reply
    },
    to: [{ email: toEmail }],
    templateId: 3,
  };

  try {
    const response = await axios.post("https://api.brevo.com/v3/smtp/email", emailData, {
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY,
      },
    });

    console.log("📧 E-mail enviado com sucesso:", response.data);
  } catch (err) {
    console.error("❌ Erro ao enviar e-mail:", err.response?.data || err.message);
  }
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { data, type } = req.body;
  const id = data?.id;
  const topic = type;

  if (topic !== "payment" || !id) {
    return res.status(400).json({ error: "Webhook inválido" });
  }

  try {
    const { data: payment } = await axios.get(
      `https://api.mercadopago.com/v1/payments/${id}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        },
      }
    );

    const description = payment.description || "";
    const match = description.match(/subscription_id=([\w-]+)/);

    if (!match) {
      console.warn("⚠️ subscription_id não encontrado na descrição:", description);
      return res.status(400).json({ error: "subscription_id não encontrado na descrição" });
    }

    const subscriptionId = match[1];
    console.log("🔍 subscription_id extraído:", subscriptionId);

    if (payment.status === "approved") {
      const { data: updatedData, error } = await supabase
        .from("subscriptions")
        .update({ status: "active" })
        .eq("subscription_id", subscriptionId)
        .select();

      if (error) {
        console.error("❌ Erro ao ativar assinatura:", error);
        return res.status(500).json({ error: "Erro ao ativar assinatura" });
      }

      if (!updatedData || updatedData.length === 0) {
        console.warn("⚠️ Nenhuma linha foi atualizada. Verifique se o ID existe:", subscriptionId);
        return res.status(200).json({ warning: "Nenhuma linha atualizada. ID pode não existir." });
      }

      const customerEmail = updatedData[0]?.customer_email;

      if (customerEmail) {
        await sendEmailWithBrevo(customerEmail);
      } else {
        console.warn("⚠️ E-mail do cliente não encontrado na assinatura:", subscriptionId);
      }

      // WhatsApp via CallMeBot
      const whatsappMessage = `✅ Nova assinatura confirmada!\nPlano: ${description}\nEmail: ${payment.payer?.email || "desconhecido"}`;
      const phoneNumber = "554491012085";
      const apiKey = process.env.CALLMEBOT_API_KEY;

      try {
        await axios.get(`https://api.callmebot.com/whatsapp.php?phone=${phoneNumber}&text=${encodeURIComponent(whatsappMessage)}&apikey=${apiKey}`);
        console.log("📲 Mensagem enviada no WhatsApp");
      } catch (err) {
        console.error("❌ Erro ao enviar WhatsApp:", err.message);
      }

      return res.status(200).json({ success: true });
    }

    if (["cancelled", "rejected", "expired", "refunded"].includes(payment.status)) {
      const { error } = await supabase
        .from("subscriptions")
        .delete()
        .eq("subscription_id", subscriptionId);

      if (error) {
        console.error("❌ Erro ao excluir assinatura:", error);
        return res.status(500).json({ error: "Erro ao excluir assinatura" });
      }

      console.log("🗑️ Assinatura excluída (pagamento cancelado):", subscriptionId);
      return res.status(200).json({ deleted: true });
    }

    console.log("ℹ️ Pagamento ainda não aprovado:", payment.status);
    return res.status(200).json({ message: "Pagamento ainda não aprovado" });

  } catch (error) {
    if (error.response?.status === 404) {
      console.warn("⚠️ Pagamento não encontrado. Pode ser simulação/teste.");
      return res.status(200).json({ ignored: true });
    }

    console.error("🚨 Erro no webhook:", error.response?.data || error.message);
    return res.status(500).json({ error: "Erro interno ao processar webhook" });
  }
}
