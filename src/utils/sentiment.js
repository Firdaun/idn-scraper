// Lexicon-based Sentiment Analysis & Word Extraction for IDN Live IRC Chat

export const STOPWORDS = new Set([
    // Kata ganti & panggilan
    "aku", "kamu", "dia", "mereka", "kita", "kami", "kalian", "gua", "gue", "gw",
    "lu", "lo", "elu", "elo", "saya", "anda", "kak", "kakak", "ka", "dek", "adek",
    "bang", "mas", "mbak", "mba", "min", "mimin", "admin", "bro", "sis", "ges",
    "guys", "gaes", "cuy", "gan", "bray",

    // Kata sambung & preposisi
    "yang", "yg", "di", "ke", "dari", "dan", "atau", "tapi", "tetapi", "namun",
    "karena", "sebab", "maka", "sehingga", "jika", "kalau", "kalo", "klo", "kl",
    "untuk", "buat", "utk", "bt", "dengan", "dgn", "sama", "oleh", "pada", "kepada",
    "tentang", "seperti", "bagai", "bagaikan", "adalah", "yaitu", "yakni",

    // Penunjuk & partikel penegas
    "ini", "itu", "nih", "tuh", "deh", "dong", "sih", "kan", "kok", "loh", "lho",
    "kah", "pun", "ya", "yaa", "yaaa", "iya", "iy", "y", "ok", "oke", "sip", "lah",
    "dah", "nah", "tu", "ni", "dongg", "dehh", "sihh", "ygy",

    // Keterangan waktu, aspek, & kuantitas
    "udah", "sudah", "dah", "udh", "belum", "blm", "lagi", "lg", "sedang", "sdg",
    "akan", "mau", "pengen", "ingin", "bisa", "dapat", "dpt", "boleh", "harus",
    "kudu", "paling", "sangat", "amat", "banget", "bgt", "bngt", "bnget", "sekali", "agak", "cuma",
    "hanya", "cuman", "doang", "aja", "saja", "juga", "jg", "masih", "msh", "pernah",
    "selalu", "sering", "terus", "trs", "tadi", "td", "sekarang", "skrg", "nanti",
    "ntar", "entar", "besok", "kemarin", "kmrn",

    // Kata tanya
    "apa", "apaan", "apakah", "kenapa", "knp", "mengapa", "bagaimana", "gimana",
    "gmn", "bgmn", "siapa", "kapan", "dimana", "kemana", "darimana", "berapa", "brapa",

    // Istilah umum streaming & sapaan pengisi
    "halo", "hallo", "hello", "hai", "hi", "hey", "tes", "test", "cek", "live",
    "streaming", "stream", "nonton", "ikut", "masuk", "hadir", "pamit", "met", "selamat",
    "pagi", "siang", "sore", "malam", "malem", "mlem"
])

export const NEGATION_WORDS = new Set([
    "tidak", "tak", "tdk", "ga", "gak", "gk", "ngga", "nggak", "bukan", "bkn",
    "kurang", "krg", "belum", "blm", "jangan", "jgn"
])

export const POSITIVE_WORDS = new Set([
    // Pujian visual & pesona
    "cantik", "cantiknya", "cantikku", "cakep", "manis", "manisnya", "imut", "gemes",
    "gemoy", "lucu", "lucunya", "keren", "anggun", "glowing", "bening", "rapi",
    "wangi", "kece", "mempesona", "menawan", "cute", "pretty", "beautiful", "gorgeous",
    "stunning", "shine", "bersinar",

    // Emosi positif, rasa sayang & dukungan
    "semangat", "semangatnya", "suka", "cinta", "sayang", "sayangnya", "love", "kangen",
    "senang", "seneng", "bahagia", "mantap", "mantul", "seru", "bangga", "oshi",
    "oshiku", "terbaik", "best", "berkah", "blessing", "selamat", "terharu", "salut",
    "respect", "gokil", "top", "juara", "asik", "asyik", "enjoy", "adem", "sejuk",
    "sukses", "hebat", "proud", "favorit", "gemez", "good", "nice", "cool", "bagus", "bagusnya",

    // Tawa & kegembiraan
    "wkwk", "wkwkwk", "wkwkwkwk", "haha", "hahaha", "hahahaha", "hehe", "hehehe",
    "xixi", "xixixi", "aowk", "awokawok", "ngakak", "lol", "lmao", "kocak"
])

export const NEGATIVE_WORDS = new Set([
    // Masalah teknis streaming
    "lag", "ngelag", "patah", "patahpatah", "burik", "buram", "pecah", "muter",
    "buffering", "lemot", "macet", "delay", "ngadat", "error", "eror", "hang",
    "ngehang", "kresek", "noise", "mute", "hening", "mati", "item", "gelap",
    "drop", "freeze", "stuck", "dc", "disconnect", "rusak", "ngeblank", "blank",

    // Keluhan & emosi negatif
    "jelek", "parah", "garing", "bosen", "boring", "membosankan", "cape", "capek",
    "lelah", "sedih", "kesel", "kecewa", "bete", "males", "malesin", "hancur",
    "payah", "ampas", "sepi", "kacau", "ribet", "aneh", "lemes", "rugi", "buruk",
    "zonk", "huhu", "hiks", "nangis", "bad", "down", "flop", "toxic"
])

/**
 * Membersihkan teks dari emoji, simbol, dan URL
 * @param {string} text
 * @returns {string}
 */
export const cleanText = (text) => {
    if (!text || typeof text !== "string") return ""
    return text
        .toLowerCase()
        .replace(/https?:\/\/\S+/gi, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}

/**
 * Tokenisasi teks menjadi array kata
 * @param {string} text
 * @returns {string[]}
 */
export const tokenize = (text) => {
    const cleaned = cleanText(text)
    if (!cleaned) return []
    return cleaned.split(" ")
}

/**
 * Normalisasi kata yang memiliki pengulangan huruf atau tawa berulang
 * Contoh: 'cantiiik' -> 'cantik', 'wkwkwkwk' -> 'wkwk'
 * @param {string} word
 * @returns {string}
 */
export const normalizeWord = (word) => {
    if (!word) return ""
    
    // Normalisasi tawa khas Indonesia
    if (/^(wk)+w?$/i.test(word)) return "wkwk"
    if (/^(ha)+h?$/i.test(word)) return "haha"
    if (/^(he)+h?$/i.test(word)) return "hehe"
    if (/^(xi)+x?$/i.test(word)) return "xixi"

    // Normalisasi kata serapan/Inggris populer dengan huruf ganda asli yang dipanjangkan
    if (/^go{2,}d$/i.test(word)) return "good"
    if (/^co{2,}l$/i.test(word)) return "cool"
    if (/^swe{2,}t$/i.test(word)) return "sweet"

    // Rampingkan karakter yang berulang >= 3 kali (contoh: 'paraaah' -> 'parah', 'laaag' -> 'lag')
    return word.replace(/(.)\1{2,}/g, "$1")
}

const GREETINGS = new Set(["pagi", "siang", "sore", "malam", "malem", "datang", "menonton"])

/**
 * Menganalisis sentimen pesan secara lexicon-based dengan penanganan negasi sederhana
 * @param {string} text
 * @returns {{ sentiment: "positive" | "negative" | "neutral", score: number }}
 */
export const analyzeSentiment = (text) => {
    if (!text || typeof text !== "string") {
        return { sentiment: "neutral", score: 0 }
    }

    const tokens = tokenize(text).map(normalizeWord)
    if (tokens.length === 0) {
        return { sentiment: "neutral", score: 0 }
    }

    let posScore = 0
    let negScore = 0

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i]
        const prevToken = i > 0 ? tokens[i - 1] : null
        
        const nextToken = i < tokens.length - 1 ? tokens[i + 1] : null
        
        if (token === "selamat" && nextToken && GREETINGS.has(nextToken)) {
            continue
        }
        
        const isNegated = prevToken && NEGATION_WORDS.has(prevToken)
        const isPos = POSITIVE_WORDS.has(token)
        const isNeg = NEGATIVE_WORDS.has(token)

        if (isPos) {
            if (isNegated) {
                negScore += 1
            } else {
                posScore += 1
            }
        } else if (isNeg) {
            if (isNegated) {
                posScore += 0.5
            } else {
                negScore += 1
            }
        }
    }

    if (posScore > negScore) {
        return { sentiment: "positive", score: posScore - negScore }
    } else if (negScore > posScore) {
        return { sentiment: "negative", score: negScore - posScore }
    }

    return { sentiment: "neutral", score: 0 }
}

/**
 * Mengekstraksi kata kunci yang valid untuk Word Cloud
 * @param {string} text
 * @returns {string[]}
 */
export const extractKeywords = (text) => {
    if (!text || typeof text !== "string") return []

    const tokens = tokenize(text).map(normalizeWord)
    const keywords = []

    for (const word of tokens) {
        // Syarat kata masuk Word Cloud:
        // 1. Panjang karakter antara 3 dan 20
        // 2. Bukan angka murni
        // 3. Bukan stopword
        if (
            word.length >= 3 &&
            word.length <= 20 &&
            !/^\d+$/.test(word) &&
            !STOPWORDS.has(word)
        ) {
            keywords.push(word)
        }
    }

    return keywords
}
