import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronDown, BookOpen, AlertTriangle, ArrowLeft, ScrollText, Scale, Users, Pencil, Save, Plus, Trash2 } from 'lucide-react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ReferenceCard } from './ReferenceCard';
import { parseScriptureRef, parseWcfChapter } from '../utils/parseScriptureRef';

// ── Types ──────────────────────────────────────────────────────────────────

interface ScriptureRef {
  reference: string;
  text: string;
}

interface ConfessionRef {
  document: string;
  section: string;
  quote: string;
}

interface Doctrine {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  scriptures: ScriptureRef[];
  confessions: ConfessionRef[];
  refutedErrors: string[];
}

interface Category {
  id: string;
  name: string;
  doctrines: string[];
}

interface Heresy {
  id: string;
  name: string;
  description: string;
  proponents: string[];
  refutedBy: string[];
}

interface TheologyData {
  categories: Category[];
  doctrines: Doctrine[];
  heresies: Heresy[];
  doctrineMap: Record<string, Doctrine>;
  heresyMap: Record<string, Heresy>;
  categoryMap: Record<string, Category>;
}

interface TheolayCms {
  editMode: boolean;
  onUpdateDoctrine: (d: Doctrine) => void;
  onUpdateHeresy: (h: Heresy) => void;
}

type View =
  | { type: 'home' }
  | { type: 'doctrine'; id: string }
  | { type: 'heresy'; id: string };

// ── Static category structure (not CMS-editable in this version) ──────────

const CATEGORIES: Category[] = [
  { id: 'theology-proper', name: 'Theology Proper', doctrines: ['existence-of-god', 'divine-attributes', 'trinity'] },
  { id: 'christology', name: 'Christology', doctrines: ['eternal-son', 'incarnation', 'hypostatic-union', 'atonement', 'resurrection'] },
  { id: 'pneumatology', name: 'Pneumatology', doctrines: ['person-of-hs', 'work-of-hs'] },
  { id: 'anthropology', name: 'Anthropology', doctrines: ['imago-dei', 'original-sin', 'total-depravity'] },
  { id: 'soteriology', name: 'Soteriology', doctrines: ['election', 'effectual-calling', 'regeneration', 'justification', 'adoption', 'sanctification', 'perseverance'] },
  { id: 'ecclesiology', name: 'Ecclesiology', doctrines: ['nature-of-church', 'marks-of-church', 'sacraments'] },
  { id: 'eschatology', name: 'Eschatology', doctrines: ['second-coming', 'resurrection-dead', 'final-judgment'] },
];

// ── Default data (fallback when CMS server is unavailable) ────────────────

const DEFAULT_DOCTRINES: Doctrine[] = [
  {
    id: 'existence-of-god',
    name: 'The Existence of God',
    categoryId: 'theology-proper',
    description: 'God exists necessarily and eternally as the self-existent, uncreated being who is the source and sustainer of all creation. His existence is not derived from anything outside of himself. Scripture teaches this through natural revelation (creation, conscience) and special revelation (Scripture). God\'s existence is the foundational presupposition of all true knowledge.',
    scriptures: [
      { reference: 'Psalm 19:1', text: 'The heavens declare the glory of God; and the firmament sheweth his handywork.' },
      { reference: 'Romans 1:19–20', text: 'Because that which may be known of God is manifest in them; for God hath shewed it unto them. For the invisible things of him from the creation of the world are clearly seen...' },
      { reference: 'Exodus 3:14', text: 'And God said unto Moses, I AM THAT I AM: and he said, Thus shalt thou say unto the children of Israel, I AM hath sent me unto you.' },
      { reference: 'Hebrews 11:6', text: 'But without faith it is impossible to please him: for he that cometh to God must believe that he is, and that he is a rewarder of them that diligently seek him.' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter II, §1', quote: 'There is but one only living and true God, who is infinite in being and perfection, a most pure spirit, invisible, without body, parts, or passions; immutable, immense, eternal, incomprehensible, almighty...' },
      { document: 'Belgic Confession', section: 'Article 1', quote: 'We all believe with the heart and confess with the mouth that there is one only simple and spiritual Being, which we call God; and that He is eternal, incomprehensible, invisible, immutable, infinite, almighty...' },
    ],
    refutedErrors: ['atheism-deism', 'open-theism'],
  },
  {
    id: 'divine-attributes',
    name: 'The Divine Attributes',
    categoryId: 'theology-proper',
    description: 'God possesses certain essential attributes that belong to his nature alone (incommunicable: aseity, simplicity, immutability, impassibility, eternity, omnipresence) and others that he shares with creatures in a limited measure (communicable: holiness, love, goodness, justice, wisdom, truth). These attributes are not additions to God but are what God is in his one, simple divine essence.',
    scriptures: [
      { reference: 'Malachi 3:6', text: 'For I am the LORD, I change not; therefore ye sons of Jacob are not consumed.' },
      { reference: 'Isaiah 6:3', text: 'And one cried unto another, and said, Holy, holy, holy, is the LORD of hosts: the whole earth is full of his glory.' },
      { reference: 'John 4:24', text: 'God is a Spirit: and they that worship him must worship him in spirit and in truth.' },
      { reference: 'Psalm 90:2', text: 'Before the mountains were brought forth, or ever thou hadst formed the earth and the world, even from everlasting to everlasting, thou art God.' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter II, §1', quote: '...most holy, most free, most absolute; working all things according to the counsel of his own immutable and most righteous will, for his own glory; most loving, gracious, merciful, long-suffering, abundant in goodness and truth...' },
    ],
    refutedErrors: ['open-theism'],
  },
  {
    id: 'trinity',
    name: 'The Holy Trinity',
    categoryId: 'theology-proper',
    description: 'God exists as one Being in three co-equal, co-eternal, consubstantial Persons: Father, Son, and Holy Spirit. The three Persons are distinct but not separate—each is fully God, yet there is only one God. The Father is unbegotten; the Son is eternally begotten of the Father; the Spirit eternally proceeds from both. This is not a contradiction but a mystery of divine being foundational to all of Christianity.',
    scriptures: [
      { reference: 'Matthew 28:19', text: 'Go ye therefore, and teach all nations, baptizing them in the name of the Father, and of the Son, and of the Holy Ghost.' },
      { reference: 'John 1:1', text: 'In the beginning was the Word, and the Word was with God, and the Word was God.' },
      { reference: '2 Corinthians 13:14', text: 'The grace of the Lord Jesus Christ, and the love of God, and the communion of the Holy Ghost, be with you all.' },
      { reference: 'Deuteronomy 6:4', text: 'Hear, O Israel: The LORD our God is one LORD.' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter II, §3', quote: 'In the unity of the Godhead there be three persons, of one substance, power, and eternity: God the Father, God the Son, and God the Holy Ghost. The Father is of none, neither begotten, nor proceeding; the Son is eternally begotten of the Father; the Holy Ghost eternally proceeding from the Father and the Son.' },
      { document: 'Nicene Creed', section: '325/381 AD', quote: 'I believe in one God, the Father Almighty...And in one Lord Jesus Christ, the only-begotten Son of God...And in the Holy Ghost, the Lord and Giver of Life, who proceedeth from the Father and the Son...' },
    ],
    refutedErrors: ['arianism', 'modalism', 'socinianism'],
  },
  {
    id: 'eternal-son',
    name: 'The Eternal Sonship of Christ',
    categoryId: 'christology',
    description: 'The Son of God did not begin to exist at the incarnation. He is eternally begotten of the Father, co-equal and co-eternal with both the Father and the Spirit. His sonship is not adoptive or functional but ontological and eternal. The Second Person of the Trinity has always existed as the Son; the incarnation is his assuming human nature, not his beginning.',
    scriptures: [
      { reference: 'John 1:1–2', text: 'In the beginning was the Word, and the Word was with God, and the Word was God. The same was in the beginning with God.' },
      { reference: 'Proverbs 8:22–23', text: 'The LORD possessed me at the beginning of his work, the first of his acts of old. Ages ago I was set up, at the first, before the beginning of the earth.' },
      { reference: 'Micah 5:2', text: '...out of thee shall he come forth unto me that is to be ruler in Israel; whose goings forth have been from of old, from everlasting.' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter II, §3', quote: 'The Son is eternally begotten of the Father.' },
      { document: 'Nicene Creed', section: '325/381 AD', quote: '...begotten of his Father before all worlds, God of God, Light of Light, Very God of very God, begotten, not made, being of one substance with the Father...' },
    ],
    refutedErrors: ['arianism', 'socinianism'],
  },
  {
    id: 'incarnation',
    name: 'The Incarnation',
    categoryId: 'christology',
    description: 'The eternal Son of God took on full human nature—body and rational soul—in the womb of the Virgin Mary by the power of the Holy Spirit. The incarnation is not a transformation of God into man, nor the mere indwelling of a human person, but the assumption of a complete human nature by the eternal Son. He was born without original sin, being conceived by the Spirit, yet he took on genuine human weakness (hunger, grief, tiredness) so he could be our representative and mediator.',
    scriptures: [
      { reference: 'John 1:14', text: 'And the Word was made flesh, and dwelt among us, (and we beheld his glory, the glory as of the only begotten of the Father,) full of grace and truth.' },
      { reference: 'Isaiah 7:14', text: 'Therefore the Lord himself shall give you a sign; Behold, a virgin shall conceive, and bear a son, and shall call his name Immanuel.' },
      { reference: 'Galatians 4:4', text: 'But when the fulness of the time was come, God sent forth his Son, made of a woman, made under the law.' },
      { reference: 'Philippians 2:6–7', text: 'Who, being in the form of God, thought it not robbery to be equal with God: But made himself of no reputation, and took upon him the form of a servant, and was made in the likeness of men.' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter VIII, §2', quote: 'The Son of God, the second person in the Trinity, being very and eternal God, of one substance and equal with the Father, did, when the fullness of time was come, take upon him man\'s nature, with all the essential properties and common infirmities thereof, yet without sin...' },
    ],
    refutedErrors: ['arianism', 'nestorianism', 'eutychianism', 'docetism'],
  },
  {
    id: 'hypostatic-union',
    name: 'The Hypostatic Union',
    categoryId: 'christology',
    description: 'Jesus Christ is one Person with two distinct, complete natures—fully divine and fully human—united without mixture, change, division, or separation (Chalcedon, 451 AD). The two natures are not blended into a third thing nor is one dominant over the other. Each nature retains its own essential properties. The divine nature remains infinite, omniscient, and impassible, while the human nature is finite, subject to growth in knowledge, and capable of suffering.',
    scriptures: [
      { reference: 'Colossians 2:9', text: 'For in him dwelleth all the fulness of the Godhead bodily.' },
      { reference: 'Hebrews 4:15', text: 'For we have not an high priest which cannot be touched with the feeling of our infirmities; but was in all points tempted like as we are, yet without sin.' },
      { reference: '1 Timothy 2:5', text: 'For there is one God, and one mediator between God and men, the man Christ Jesus.' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter VIII, §2', quote: '...so that two whole, perfect, and distinct natures, the Godhead and the manhood, were inseparably joined together in one person, without conversion, composition, or confusion.' },
      { document: 'Chalcedonian Definition', section: '451 AD', quote: 'We...teach men to confess one and the same Son, our Lord Jesus Christ...in two natures, inconfusedly, unchangeably, indivisibly, inseparably; the distinction of natures being by no means taken away by the union...' },
    ],
    refutedErrors: ['nestorianism', 'eutychianism', 'arianism'],
  },
  {
    id: 'atonement',
    name: 'The Atonement',
    categoryId: 'christology',
    description: 'Christ\'s death on the cross was a substitutionary sacrifice—he bore the guilt and penalty that sinners deserved under the law. Through penal substitution he satisfied divine justice (propitiation) and reconciled sinners to God (reconciliation). The atonement is definite in its design, securing the full salvation of all the elect given to the Son by the Father, while the free offer of the gospel is made indiscriminately to all.',
    scriptures: [
      { reference: 'Isaiah 53:5–6', text: 'But he was wounded for our transgressions, he was bruised for our iniquities: the chastisement of our peace was upon him; and with his stripes we are healed. All we like sheep have gone astray...and the LORD hath laid on him the iniquity of us all.' },
      { reference: 'Romans 3:25', text: 'Whom God hath set forth to be a propitiation through faith in his blood, to declare his righteousness for the remission of sins that are past...' },
      { reference: '2 Corinthians 5:21', text: 'For he hath made him to be sin for us, who knew no sin; that we might be made the righteousness of God in him.' },
      { reference: 'John 10:11', text: 'I am the good shepherd: the good shepherd giveth his life for the sheep.' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter VIII, §5', quote: 'The Lord Jesus, by his perfect obedience, and sacrifice of himself...hath fully satisfied the justice of his Father; and purchased...an everlasting inheritance in the kingdom of heaven, for all those whom the Father hath given unto him.' },
      { document: 'Canons of Dort', section: 'Second Head, Art. 8', quote: '...the quickening and saving efficacy of the most precious death of his Son should extend to all the elect, for bestowing upon them alone the gift of justifying faith...' },
    ],
    refutedErrors: ['pelagianism', 'socinianism'],
  },
  {
    id: 'resurrection',
    name: 'The Resurrection and Ascension',
    categoryId: 'christology',
    description: 'Christ rose bodily from the dead on the third day, vindicating his person and work and securing the resurrection of all who are united to him. His resurrection body was the same body that was buried, now glorified. After forty days of appearances, he ascended to the right hand of the Father where he reigns as the exalted Lord, intercedes for his people, and from whence he will return to judge the living and the dead.',
    scriptures: [
      { reference: '1 Corinthians 15:3–4', text: 'For I delivered unto you first of all that which I also received, how that Christ died for our sins according to the scriptures; And that he was buried, and that he rose again the third day according to the scriptures.' },
      { reference: 'Acts 1:9–11', text: 'And when he had spoken these things, while they beheld, he was taken up; and a cloud received him out of their sight...this same Jesus, which is taken up from you into heaven, shall so come in like manner as ye have seen him go into heaven.' },
      { reference: 'Hebrews 7:25', text: 'Wherefore he is able also to save them to the uttermost that come unto God by him, seeing he ever liveth to make intercession for them.' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter VIII, §4', quote: 'On the third day he arose from the dead, with the same body in which he suffered...ascended into heaven, and there sitteth at the right hand of his Father, making intercession...' },
    ],
    refutedErrors: [],
  },
  {
    id: 'person-of-hs',
    name: 'The Person of the Holy Spirit',
    categoryId: 'pneumatology',
    description: 'The Holy Spirit is the third Person of the Trinity—not a force or impersonal power, but a distinct divine Person fully equal in essence with the Father and the Son. He possesses all divine attributes and is personally distinguished from the Father and the Son by his eternal procession from both. He is called "he," grieves, intercedes, teaches, and may be lied to—all marks of personal being.',
    scriptures: [
      { reference: 'John 14:26', text: 'But the Comforter, which is the Holy Ghost, whom the Father will send in my name, he shall teach you all things...' },
      { reference: 'Acts 5:3–4', text: 'But Peter said, Ananias, why hath Satan filled thine heart to lie to the Holy Ghost?...thou hast not lied unto men, but unto God.' },
      { reference: '1 Corinthians 12:11', text: 'But all these worketh that one and the selfsame Spirit, dividing to every man severally as he will.' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter II, §3', quote: 'In the unity of the Godhead there be three persons...the Holy Ghost eternally proceeding from the Father and the Son.' },
    ],
    refutedErrors: ['modalism', 'arianism'],
  },
  {
    id: 'work-of-hs',
    name: 'The Work of the Holy Spirit',
    categoryId: 'pneumatology',
    description: 'The Holy Spirit applies the redemption purchased by Christ to the elect. His works include regeneration (new birth), conviction of sin, illumination of the Word, drawing sinners to faith, indwelling believers, progressively sanctifying them, producing the fruit of the Spirit, sealing them unto the day of redemption, and gifting the church for ministry. He does not work apart from the Word but through it.',
    scriptures: [
      { reference: 'John 3:5–6', text: 'Jesus answered, Verily, verily, I say unto thee, Except a man be born of water and of the Spirit, he cannot enter into the kingdom of God.' },
      { reference: 'Galatians 5:22–23', text: 'But the fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith, Meekness, temperance: against such there is no law.' },
      { reference: 'Ephesians 1:13–14', text: 'In whom ye also trusted...ye were sealed with that holy Spirit of promise, Which is the earnest of our inheritance until the redemption of the purchased possession...' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter X, §1', quote: 'All those whom God hath predestinated unto life, and those only, he is pleased, in his appointed and accepted time, effectually to call, by his Word and Spirit...' },
    ],
    refutedErrors: ['pelagianism', 'semi-pelagianism'],
  },
  {
    id: 'imago-dei',
    name: 'The Image of God (Imago Dei)',
    categoryId: 'anthropology',
    description: 'Human beings were created in the image and likeness of God (imago Dei), which distinguishes them from all other creatures. This image includes rationality, morality, spirituality, and relational capacity. Though marred by the Fall, the image is not entirely destroyed but is deeply corrupted and requires renewal through union with Christ, who is himself the perfect image of God.',
    scriptures: [
      { reference: 'Genesis 1:26–27', text: 'And God said, Let us make man in our image, after our likeness...So God created man in his own image, in the image of God created he him; male and female created he them.' },
      { reference: 'Colossians 3:10', text: 'And have put on the new man, which is renewed in knowledge after the image of him that created him.' },
      { reference: 'Genesis 9:6', text: 'Whoso sheddeth man\'s blood, by man shall his blood be shed: for in the image of God made he man.' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter IV, §2', quote: 'After God had made all other creatures, he created man, male and female, with reasonable and immortal souls, endued with knowledge, righteousness, and true holiness, after his own image...' },
    ],
    refutedErrors: [],
  },
  {
    id: 'original-sin',
    name: 'Original Sin',
    categoryId: 'anthropology',
    description: 'Adam was the federal (covenant) head of the human race. When he sinned in the Garden, his guilt was imputed to all his descendants, and his corrupted nature was passed on to them. Original sin therefore includes both the guilt of Adam\'s first transgression (imputed guilt) and the consequent corruption of human nature (inherited depravity). Every person since Adam enters the world guilty and spiritually dead.',
    scriptures: [
      { reference: 'Romans 5:12', text: 'Wherefore, as by one man sin entered into the world, and death by sin; and so death passed upon all men, for that all have sinned.' },
      { reference: 'Psalm 51:5', text: 'Behold, I was shapen in iniquity; and in sin did my mother conceive me.' },
      { reference: 'Romans 5:18–19', text: 'Therefore as by the offence of one judgment came upon all men to condemnation; even so by the righteousness of one the free gift came upon all men unto justification of life.' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter VI, §§1–3', quote: 'Our first parents...fell from their original righteousness and communion with God, and so became dead in sin...They being the root of all mankind, the guilt of this sin was imputed, and the same death in sin and corrupted nature, conveyed to all their posterity...' },
    ],
    refutedErrors: ['pelagianism', 'semi-pelagianism'],
  },
  {
    id: 'total-depravity',
    name: 'Total Depravity',
    categoryId: 'anthropology',
    description: 'As a result of the Fall, every faculty of the human soul—mind, will, affections, and conscience—is corrupted by sin. Total depravity does not mean every person is as sinful as possible, but that sin has affected every part of human nature such that, apart from grace, no one can or will choose God. The will is not neutral but is enslaved to sin and cannot of itself seek or embrace God.',
    scriptures: [
      { reference: 'Romans 3:10–12', text: 'As it is written, There is none righteous, no, not one: There is none that understandeth, there is none that seeketh after God. They are all gone out of the way...' },
      { reference: 'Jeremiah 17:9', text: 'The heart is deceitful above all things, and desperately wicked: who can know it?' },
      { reference: 'John 6:44', text: 'No man can come to me, except the Father which hath sent me draw him: and I will raise him up at the last day.' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter VI, §4', quote: 'From this original corruption, whereby we are utterly indisposed, disabled, and made opposite to all good, and wholly inclined to all evil, do proceed all actual transgressions.' },
      { document: 'Canons of Dort', section: 'Third/Fourth Head, Art. 3', quote: '...all men are conceived in sin, and by nature are children of wrath, incapable of saving good, prone to evil, dead in sin, and in bondage thereto...' },
    ],
    refutedErrors: ['pelagianism', 'semi-pelagianism'],
  },
  {
    id: 'election',
    name: 'Election and Predestination',
    categoryId: 'soteriology',
    description: 'Before the foundation of the world, God freely chose certain individuals for salvation in Christ—not based on any foreseen faith or merit in them, but solely according to his sovereign will and grace. This unconditional election is the ultimate ground of the believer\'s faith and perseverance, ensuring that all whom the Father has given to the Son will come to him and be kept to the end.',
    scriptures: [
      { reference: 'Ephesians 1:4–5', text: 'According as he hath chosen us in him before the foundation of the world, that we should be holy and without blame before him in love: Having predestinated us unto the adoption of children by Jesus Christ to himself, according to the good pleasure of his will.' },
      { reference: 'Romans 9:11–13', text: 'For the children being not yet born, neither having done any good or evil, that the purpose of God according to election might stand, not of works, but of him that calleth...Jacob have I loved, but Esau have I hated.' },
      { reference: 'John 6:37', text: 'All that the Father giveth me shall come to me; and him that cometh to me I will in no wise cast out.' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter III, §§3,5', quote: 'By the decree of God, for the manifestation of his glory, some men and angels are predestinated unto everlasting life...Those of mankind that are predestinated unto life, God...hath chosen in Christ, unto everlasting glory, out of his mere free grace and love, without any foresight of faith or good works...' },
      { document: 'Canons of Dort', section: 'First Head, Art. 7', quote: 'Election is the unchangeable purpose of God, whereby, before the foundation of the world, he hath out of mere grace, according to the sovereign good pleasure of his own will, chosen...a certain number of persons to redemption in Christ...' },
    ],
    refutedErrors: ['semi-pelagianism', 'open-theism'],
  },
  {
    id: 'effectual-calling',
    name: 'Effectual Calling',
    categoryId: 'soteriology',
    description: 'God calls the elect through the outward preaching of the gospel (external call), but also inwardly and effectually by the Holy Spirit. This effectual call overcomes spiritual blindness and resistance, creating in the elect a genuine willingness and ability to embrace Christ. It is entirely a work of divine grace—the elect do not cooperate to make the call effectual; rather, the Spirit makes them willing to respond.',
    scriptures: [
      { reference: 'Romans 8:30', text: 'Moreover whom he did predestinate, them he also called: and whom he called, them he also justified: and whom he justified, them he also glorified.' },
      { reference: 'John 6:44', text: 'No man can come to me, except the Father which hath sent me draw him: and I will raise him up at the last day.' },
      { reference: '1 Corinthians 1:23–24', text: 'But we preach Christ crucified...But unto them which are called, both Jews and Greeks, Christ the power of God, and the wisdom of God.' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter X, §1', quote: 'All those whom God hath predestinated unto life, and those only, he is pleased, in his appointed and accepted time, effectually to call, by his Word and Spirit, out of that state of sin and death...to grace and salvation by Jesus Christ...' },
    ],
    refutedErrors: ['pelagianism', 'semi-pelagianism'],
  },
  {
    id: 'regeneration',
    name: 'Regeneration',
    categoryId: 'soteriology',
    description: 'Regeneration is the supernatural work of the Holy Spirit by which a spiritually dead sinner is made spiritually alive. It precedes and produces faith, not the reverse—the new birth is not a response to faith but its cause. The regenerate person receives a new heart with new desires, enabling and inclining them to believe and repent. This is entirely a work of divine monergism, not a cooperation of divine and human wills.',
    scriptures: [
      { reference: 'John 3:3,5–6', text: 'Jesus answered and said unto him, Verily, verily, I say unto thee, Except a man be born again, he cannot see the kingdom of God...Except a man be born of water and of the Spirit, he cannot enter into the kingdom of God.' },
      { reference: 'Ezekiel 36:26', text: 'A new heart also will I give you, and a new spirit will I put within you: and I will take away the stony heart out of your flesh, and I will give you an heart of flesh.' },
      { reference: 'Ephesians 2:1,5', text: 'And you hath he quickened, who were dead in trespasses and sins...Even when we were dead in sins, hath quickened us together with Christ...' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter X, §2', quote: 'This effectual call is of God\'s free and special grace alone, not from anything at all foreseen in man, who is altogether passive therein, until, being quickened and renewed by the Holy Spirit, he is thereby enabled to answer this call...' },
    ],
    refutedErrors: ['pelagianism', 'semi-pelagianism'],
  },
  {
    id: 'justification',
    name: 'Justification by Faith Alone',
    categoryId: 'soteriology',
    description: 'Justification is a forensic (legal) act of God in which he declares the sinner righteous on the basis of Christ\'s imputed righteousness. It is received through faith alone (sola fide), not by works or merit. The ground is Christ\'s perfect active obedience (fulfilling the law) and passive obedience (suffering the penalty). Faith is the instrument—not the ground—of justification, and even that faith is a gift of God.',
    scriptures: [
      { reference: 'Romans 3:28', text: 'Therefore we conclude that a man is justified by faith without the deeds of the law.' },
      { reference: 'Romans 4:5', text: 'But to him that worketh not, but believeth on him that justifieth the ungodly, his faith is counted for righteousness.' },
      { reference: 'Philippians 3:9', text: 'And be found in him, not having mine own righteousness, which is of the law, but that which is through the faith of Christ, the righteousness which is of God by faith.' },
      { reference: 'Galatians 2:16', text: 'Knowing that a man is not justified by the works of the law, but by the faith of Jesus Christ...' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter XI, §§1–2', quote: 'Those whom God effectually calleth, he also freely justifieth: not by infusing righteousness into them, but by pardoning their sins, and by accounting and accepting their persons as righteous...Faith, thus receiving and resting on Christ and his righteousness, is the alone instrument of justification...' },
    ],
    refutedErrors: ['pelagianism', 'semi-pelagianism', 'socinianism'],
  },
  {
    id: 'adoption',
    name: 'Adoption',
    categoryId: 'soteriology',
    description: 'All who are justified are also adopted into the family of God as his sons and daughters. Adoption is distinct from justification: justification changes legal standing (condemned → righteous), while adoption confers family membership and its privileges—access to the Father, the indwelling Spirit as the Spirit of adoption, the right to cry "Abba, Father," and the inheritance of eternal life as co-heirs with Christ.',
    scriptures: [
      { reference: 'John 1:12', text: 'But as many as received him, to them gave he power to become the sons of God, even to them that believe on his name.' },
      { reference: 'Romans 8:15–17', text: 'For ye have not received the spirit of bondage again to fear; but ye have received the Spirit of adoption, whereby we cry, Abba, Father...And if children, then heirs; heirs of God, and joint-heirs with Christ.' },
      { reference: 'Galatians 4:4–5', text: 'But when the fulness of the time was come, God sent forth his Son...To redeem them that were under the law, that we might receive the adoption of sons.' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter XII, §1', quote: 'All those that are justified, God vouchsafeth, in and for his only Son Jesus Christ, to make partakers of the grace of adoption, by which they are taken into the number, and enjoy the liberties and privileges of the children of God...' },
    ],
    refutedErrors: [],
  },
  {
    id: 'sanctification',
    name: 'Sanctification',
    categoryId: 'soteriology',
    description: 'Sanctification is the ongoing work of the Holy Spirit whereby the justified believer is progressively conformed to the image of Christ. It involves the mortification of sin (putting to death the deeds of the body) and the vivification of righteousness (growing in grace and holiness). Unlike justification—instantaneous and complete—sanctification is gradual and remains imperfect in this life, reaching completion only at glorification.',
    scriptures: [
      { reference: '1 Thessalonians 4:3', text: 'For this is the will of God, even your sanctification...' },
      { reference: 'Romans 6:13', text: 'Neither yield ye your members as instruments of unrighteousness unto sin: but yield yourselves unto God, as those that are alive from the dead, and your members as instruments of righteousness unto God.' },
      { reference: '2 Peter 3:18', text: 'But grow in grace, and in the knowledge of our Lord and Saviour Jesus Christ.' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter XIII, §1', quote: 'They, who are once effectually called, and regenerated, having a new heart, and a new spirit created in them, are further sanctified...through the virtue of Christ\'s death and resurrection, by his Word and Spirit dwelling in them...' },
    ],
    refutedErrors: ['pelagianism'],
  },
  {
    id: 'perseverance',
    name: 'Perseverance of the Saints',
    categoryId: 'soteriology',
    description: 'All those who are truly regenerated, justified, and adopted will persevere in faith to the end and be glorified. Their perseverance is guaranteed not by their own strength but by God\'s preservation—grounded in eternal election, Christ\'s intercession, and the indwelling Spirit\'s sealing. True believers may fall into serious sin and seasons of doubt, but they will not ultimately and finally fall away from grace.',
    scriptures: [
      { reference: 'John 10:27–29', text: 'My sheep hear my voice, and I know them, and they follow me: And I give unto them eternal life; and they shall never perish, neither shall any man pluck them out of my hand.' },
      { reference: 'Romans 8:38–39', text: 'For I am persuaded, that neither death, nor life...nor any other creature, shall be able to separate us from the love of God, which is in Christ Jesus our Lord.' },
      { reference: 'Philippians 1:6', text: 'Being confident of this very thing, that he which hath begun a good work in you will perform it until the day of Jesus Christ.' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter XVII, §1', quote: 'They, whom God hath accepted in his beloved, effectually called, and sanctified by his Spirit, can neither totally nor finally fall away from the state of grace, but shall certainly persevere therein to the end, and be eternally saved.' },
      { document: 'Canons of Dort', section: 'Fifth Head, Art. 8', quote: '...it is not in consequence of their own merits or strength, but of God\'s free mercy, that they do not totally fall from faith and grace, nor continue and perish finally in their backslidings...' },
    ],
    refutedErrors: [],
  },
  {
    id: 'nature-of-church',
    name: 'The Nature of the Church',
    categoryId: 'ecclesiology',
    description: 'The Church is the body of Christ, the communion of all the elect throughout all ages. Reformed theology distinguishes the invisible church (the body of all the truly elect, known to God alone) from the visible church (all who profess faith and their children, gathered in congregations). Christ is the only Head of the church. The church is one, holy, catholic, and apostolic.',
    scriptures: [
      { reference: 'Ephesians 1:22–23', text: 'And hath put all things under his feet, and gave him to be the head over all things to the church, Which is his body, the fulness of him that filleth all in all.' },
      { reference: 'Matthew 16:18', text: 'And I say also unto thee, That thou art Peter, and upon this rock I will build my church; and the gates of hell shall not prevail against it.' },
      { reference: 'Hebrews 12:23', text: 'To the general assembly and church of the firstborn, which are written in heaven...' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter XXV, §§1–2', quote: 'The catholic or universal Church, which is invisible, consists of the whole number of the elect...The visible Church...consists of all those throughout the world that profess the true religion, and of their children...' },
    ],
    refutedErrors: [],
  },
  {
    id: 'marks-of-church',
    name: 'The Marks of the Church',
    categoryId: 'ecclesiology',
    description: 'The Reformed tradition identifies three marks (notae) that distinguish a true church: (1) the pure preaching of the Word of God, (2) the right administration of the sacraments as instituted by Christ, and (3) the faithful exercise of church discipline. These marks distinguish true churches from false ones and from parachurch organizations. A church may be more or less pure according to how clearly these marks are present.',
    scriptures: [
      { reference: '2 Timothy 4:2', text: 'Preach the word; be instant in season, out of season; reprove, rebuke, exhort with all longsuffering and doctrine.' },
      { reference: 'Matthew 18:17', text: 'And if he shall neglect to hear them, tell it unto the church: but if he neglect to hear the church, let him be unto thee as an heathen man and a publican.' },
    ],
    confessions: [
      { document: 'Belgic Confession', section: 'Article 29', quote: 'The marks by which the true Church is known are these: If the pure doctrine of the gospel is preached therein; if she maintains the pure administration of the sacraments as instituted by Christ; if church discipline is exercised in punishing of sin...' },
    ],
    refutedErrors: [],
  },
  {
    id: 'sacraments',
    name: 'The Sacraments',
    categoryId: 'ecclesiology',
    description: 'The sacraments (baptism and the Lord\'s Supper) are holy signs and seals of the covenant of grace, appointed by Christ. They do not confer grace mechanically (ex opere operato) but are effectual means of grace when received with faith, through the working of the Holy Spirit. Baptism signifies and seals incorporation into the covenant community; the Lord\'s Supper is a memorial and a spiritual feeding on Christ through faith.',
    scriptures: [
      { reference: 'Matthew 28:19', text: 'Go ye therefore, and teach all nations, baptizing them in the name of the Father, and of the Son, and of the Holy Ghost.' },
      { reference: '1 Corinthians 11:23–26', text: 'For I have received of the Lord that which also I delivered unto you, That the Lord Jesus the same night in which he was betrayed took bread...this do in remembrance of me.' },
      { reference: 'Romans 4:11', text: 'And he received the sign of circumcision, a seal of the righteousness of the faith which he had yet being uncircumcised...' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter XXVII, §1', quote: 'Sacraments are holy signs and seals of the covenant of grace, immediately instituted by God, to represent Christ and his benefits; and to confirm our interest in him...' },
    ],
    refutedErrors: [],
  },
  {
    id: 'second-coming',
    name: 'The Second Coming of Christ',
    categoryId: 'eschatology',
    description: 'Christ will return visibly, bodily, and gloriously at a time known only to the Father. His return will be personal and public, witnessed by all humanity. The Second Coming will inaugurate the resurrection of the dead, the final judgment, and the full consummation of God\'s kingdom. The church is called to watch and pray, holding all end-time speculation loosely and trusting in the certainty of Christ\'s return.',
    scriptures: [
      { reference: 'Acts 1:11', text: 'Which also said, Ye men of Galilee, why stand ye gazing up into heaven? this same Jesus, which is taken up from you into heaven, shall so come in like manner as ye have seen him go into heaven.' },
      { reference: 'Matthew 24:36', text: 'But of that day and hour knoweth no man, no, not the angels of heaven, but my Father only.' },
      { reference: '1 Thessalonians 4:16', text: 'For the Lord himself shall descend from heaven with a shout, with the voice of the archangel, and with the trump of God: and the dead in Christ shall rise first.' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter XXXIII, §1', quote: 'God hath appointed a day, wherein he will judge the world, in righteousness, by Jesus Christ, to whom all power and judgment is given of the Father.' },
    ],
    refutedErrors: [],
  },
  {
    id: 'resurrection-dead',
    name: 'The Resurrection of the Dead',
    categoryId: 'eschatology',
    description: 'At the last day, all who have died will be bodily resurrected—the righteous to everlasting life and the wicked to eternal condemnation. The resurrection of believers is patterned after and secured by Christ\'s resurrection. It involves the same body, raised in a glorified and incorruptible form. The soul does not sleep between death and resurrection but is immediately with Christ in a conscious state of blessedness.',
    scriptures: [
      { reference: 'John 5:28–29', text: 'Marvel not at this: for the hour is coming, in the which all that are in the graves shall hear his voice, And shall come forth; they that have done good, unto the resurrection of life; and they that have done evil, unto the resurrection of damnation.' },
      { reference: '1 Corinthians 15:52–53', text: 'In a moment, in the twinkling of an eye, at the last trump: for the trumpet shall sound, and the dead shall be raised incorruptible, and we shall be changed.' },
      { reference: 'Philippians 3:21', text: 'Who shall change our vile body, that it may be fashioned like unto his glorious body...' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter XXXII, §§1–3', quote: 'The bodies of men, after death, return to dust...but their souls...immediately return to God who gave them. The souls of the righteous, being then made perfect in holiness, are received into the highest heavens...The bodies of the just...shall be raised in power, spiritual, incorruptible, and made like to his glorious body.' },
    ],
    refutedErrors: [],
  },
  {
    id: 'final-judgment',
    name: 'The Final Judgment',
    categoryId: 'eschatology',
    description: 'God has appointed a day on which he will judge the world in righteousness by Jesus Christ. All persons—living and dead—will stand before the judgment seat of Christ. Believers will be acquitted on the basis of Christ\'s imputed righteousness and receive the fullness of their inheritance. The wicked will be condemned to eternal punishment. The judgment will vindicate God\'s perfect justice and magnify his grace toward the elect.',
    scriptures: [
      { reference: 'Romans 14:12', text: 'So then every one of us shall give account of himself to God.' },
      { reference: 'Revelation 20:12', text: 'And I saw the dead, small and great, stand before God; and the books were opened: and another book was opened, which is the book of life: and the dead were judged out of those things which were written in the books, according to their works.' },
      { reference: '2 Corinthians 5:10', text: 'For we must all appear before the judgment seat of Christ; that every one may receive the things done in his body, according to that he hath done, whether it be good or bad.' },
    ],
    confessions: [
      { document: 'Westminster Confession of Faith', section: 'Chapter XXXIII, §§1–2', quote: 'God hath appointed a day, wherein he will judge the world, in righteousness, by Jesus Christ...The end of God\'s appointing this day is for the manifestation of the glory of his mercy, in the eternal salvation of the elect; and of his justice, in the damnation of the reprobate...' },
    ],
    refutedErrors: [],
  },
];

const DEFAULT_HERESIES: Heresy[] = [
  {
    id: 'arianism',
    name: 'Arianism',
    description: 'Arianism is the teaching that the Son of God is a created being—the first and greatest creation of God—but not co-eternal or co-equal with the Father. Named after Arius of Alexandria (256–336 AD), the central slogan of Arianism is "there was a time when the Son was not." The Son is divine in a subordinate, derivative sense, but is not truly and fully God. This heresy was condemned at the Council of Nicaea (325 AD) and reaffirmed at Constantinople (381 AD), which produced the Nicene Creed.',
    proponents: [
      'Arius of Alexandria (256–336 AD)',
      'Eusebius of Nicomedia (d. 341 AD)',
      'The Arian coalition at the Council of Nicaea',
      "Jehovah's Witnesses (modern resurgence)",
      'Some Unitarian and liberal Protestant groups',
    ],
    refutedBy: ['trinity', 'eternal-son', 'incarnation', 'hypostatic-union', 'person-of-hs'],
  },
  {
    id: 'modalism',
    name: 'Modalism (Sabellianism)',
    description: 'Modalism (also called Sabellianism, after Sabellius, 3rd century) denies the distinct Persons of the Trinity. Instead, it teaches that Father, Son, and Holy Spirit are three different modes or manifestations of the one God—like a single actor wearing different masks at different times. There is one divine Person who reveals himself sequentially in different modes. This view was condemned as heretical because it denies the eternal personal distinctions within the one divine essence that Scripture clearly teaches.',
    proponents: [
      'Sabellius (3rd century)',
      'Noetus of Smyrna (late 2nd century)',
      'Praxeas (2nd–3rd century)',
      'Oneness Pentecostalism (modern resurgence)',
    ],
    refutedBy: ['trinity', 'person-of-hs'],
  },
  {
    id: 'pelagianism',
    name: 'Pelagianism',
    description: 'Pelagianism is the teaching of the British monk Pelagius (354–418 AD) that human beings are not born with original sin and retain the full natural capacity to choose good or evil without divine grace. God\'s grace is merely an external aid (example, teaching, forgiveness) rather than an inward transformation; it is not required for the first act of faith. Each person is born innocent, as Adam was created, and can obey God by their own free will. Pelagianism was condemned at the Council of Carthage (418 AD) and later at Ephesus (431 AD).',
    proponents: [
      'Pelagius (354–418 AD)',
      'Caelestius (fl. early 5th century)',
      'Julian of Eclanum (386–455 AD)',
      'Many contemporary evangelicals who implicitly deny original sin and total depravity',
    ],
    refutedBy: ['original-sin', 'total-depravity', 'effectual-calling', 'regeneration', 'justification', 'sanctification', 'work-of-hs'],
  },
  {
    id: 'semi-pelagianism',
    name: 'Semi-Pelagianism',
    description: 'Semi-Pelagianism acknowledges the effects of the Fall but holds that the human will retains enough strength to make the first move toward God (the initium fidei—the beginning of faith). Grace then cooperates with this initial human effort. God\'s election is based on his foreknowledge of who will freely choose him. This mediating position was condemned at the Second Council of Orange (529 AD). It differs from Pelagianism in affirming the need for grace, but it still compromises the total inability of the will and the sovereignty of grace in salvation.',
    proponents: [
      'John Cassian (360–435 AD)',
      'Faustus of Riez (408–490 AD)',
      'Vincent of Lérins (d. ~445 AD)',
      'Much of medieval scholastic theology',
      'Many contemporary Arminian and evangelical traditions',
    ],
    refutedBy: ['original-sin', 'total-depravity', 'election', 'effectual-calling', 'regeneration', 'work-of-hs'],
  },
  {
    id: 'socinianism',
    name: 'Socinianism',
    description: 'Socinianism is a 16th–17th century rationalist movement founded by Fausto Sozzini (1539–1604) that denies the Trinity, the pre-existence and full deity of Christ, original sin, penal substitutionary atonement, and predestination. Christ is regarded as a uniquely holy man who was elevated to divine status after his resurrection, serving primarily as a moral example. Socinianism is an antecedent to modern Unitarianism and has deeply influenced liberal Protestantism.',
    proponents: [
      'Fausto Sozzini (1539–1604)',
      'Lelio Sozzini (1525–1562)',
      'The Polish Brethren (16th–17th century)',
      'Unitarian movements (17th century onwards)',
      'Modern theological liberalism (in various forms)',
    ],
    refutedBy: ['trinity', 'eternal-son', 'incarnation', 'atonement', 'justification'],
  },
  {
    id: 'nestorianism',
    name: 'Nestorianism',
    description: 'Nestorianism (associated with Nestorius, Archbishop of Constantinople, d. ~451 AD) is the view that Christ has two distinct natures united in a merely moral or relational union, effectively constituting two separate persons—a divine person and a human person. On this view, Mary is the mother of the human Christ only (Christotokos, "Christ-bearer"), not the Mother of God (Theotokos). The practical result is a Christ divided into two subjects. Nestorianism was condemned at the Council of Ephesus (431 AD).',
    proponents: [
      'Nestorius of Constantinople (386–450 AD)',
      'Theodore of Mopsuestia (350–428 AD)',
      'The Church of the East (historically associated, though the connection is debated)',
    ],
    refutedBy: ['hypostatic-union', 'incarnation'],
  },
  {
    id: 'eutychianism',
    name: 'Eutychianism (Monophysitism)',
    description: 'Eutychianism (named for the monk Eutyches, 380–456 AD) teaches that Christ\'s humanity was absorbed into his divinity at the incarnation, producing a single, mixed nature that is neither fully divine nor fully human—sometimes described as a third thing. This position, often called Monophysitism ("one nature"), was condemned at the Council of Chalcedon (451 AD), which defined that Christ has two natures—divine and human—existing without mixture, change, division, or separation.',
    proponents: [
      'Eutyches (380–456 AD)',
      'Dioscorus of Alexandria (d. 454 AD)',
      'The Oriental Orthodox churches (in a modified Miaphysite form)',
    ],
    refutedBy: ['hypostatic-union', 'incarnation'],
  },
  {
    id: 'docetism',
    name: 'Docetism',
    description: 'Docetism (from the Greek dokein, "to seem" or "to appear") is an early heresy teaching that Christ only appeared to have a physical body—his humanity was an illusion. Being entirely divine, he did not truly suffer, die, or rise bodily. Docetism was typically associated with Gnostic movements that viewed matter as evil and therefore incompatible with true deity. It was condemned by the early church fathers and is implicitly refuted by the Apostle John\'s letters, which stress the physical reality of Christ\'s coming in the flesh.',
    proponents: [
      'Various Gnostic groups (1st–3rd centuries)',
      'Cerinthus (late 1st century)',
      'Marcion (85–160 AD) in a qualified form',
    ],
    refutedBy: ['incarnation', 'hypostatic-union'],
  },
  {
    id: 'open-theism',
    name: 'Open Theism',
    description: 'Open Theism is a contemporary theological position that denies exhaustive divine foreknowledge of future free choices. God is "open" to the future because he has granted humans libertarian free will, meaning future contingent events are genuinely unknown to him before they occur. God takes risks, may be surprised by human decisions, and sometimes has plans that fail. This view compromises the classical attributes of divine omniscience and immutability and is in fundamental tension with the Reformed doctrines of election and providence.',
    proponents: [
      'Clark Pinnock (1937–2010)',
      'John Sanders (b. 1956)',
      'Greg Boyd (b. 1957)',
      'Richard Rice',
    ],
    refutedBy: ['existence-of-god', 'divine-attributes', 'election'],
  },
  {
    id: 'atheism-deism',
    name: 'Atheism and Deism',
    description: 'Atheism denies the existence of God altogether; deism acknowledges a creator but denies his ongoing, personal involvement in the world (a "clockmaker" God who winds up creation and leaves it to run). Both positions are refuted by Scripture\'s consistent teaching of a God who is both the creator and the sustainer of all things, who acts in history, reveals himself in Scripture, and personally cares for his creatures. Natural revelation renders both positions without excuse.',
    proponents: [
      'Epicurus (341–270 BC) — ancient naturalism',
      'David Hume (1711–1776) — empirical skepticism about theism',
      'Voltaire (1694–1778) — Deism',
      'Friedrich Nietzsche (1844–1900) — atheistic nihilism',
      'Contemporary New Atheism (Dawkins, Hitchens, Dennett, Harris)',
    ],
    refutedBy: ['existence-of-god', 'divine-attributes'],
  },
];

// ── Shared edit styles ─────────────────────────────────────────────────────

const editInput = (extra?: React.CSSProperties): React.CSSProperties => ({
  width: '100%',
  padding: '7px 10px',
  borderRadius: 8,
  border: '1px solid var(--border-soft)',
  background: 'var(--bg-surface)',
  fontSize: '0.88rem',
  fontFamily: 'var(--font-sans)',
  color: 'var(--text-primary)',
  boxSizing: 'border-box',
  ...extra,
});

const fieldLabel: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 700,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 4,
  display: 'block',
};

// ── Sub-components ─────────────────────────────────────────────────────────

function DoctrineDetail({
  doctrine,
  data,
  onNavigate,
  cms,
}: {
  doctrine: Doctrine;
  data: TheologyData;
  onNavigate: (view: View) => void;
  cms?: TheolayCms;
}) {
  const { categoryMap, heresyMap } = data;
  const category = categoryMap[doctrine.categoryId];
  const relatedHeresies = doctrine.refutedErrors.map(id => heresyMap[id]).filter(Boolean);
  const isEditing = !!cms?.editMode;

  const update = (patch: Partial<Doctrine>) =>
    cms?.onUpdateDoctrine({ ...doctrine, ...patch });

  const updateScripture = (i: number, field: 'reference' | 'text', val: string) =>
    update({ scriptures: doctrine.scriptures.map((s, idx) => idx === i ? { ...s, [field]: val } : s) });
  const removeScripture = (i: number) =>
    update({ scriptures: doctrine.scriptures.filter((_, idx) => idx !== i) });
  const addScripture = () =>
    update({ scriptures: [...doctrine.scriptures, { reference: '', text: '' }] });

  const updateConfession = (i: number, field: 'document' | 'section' | 'quote', val: string) =>
    update({ confessions: doctrine.confessions.map((c, idx) => idx === i ? { ...c, [field]: val } : c) });
  const removeConfession = (i: number) =>
    update({ confessions: doctrine.confessions.filter((_, idx) => idx !== i) });
  const addConfession = () =>
    update({ confessions: [...doctrine.confessions, { document: '', section: '', quote: '' }] });

  const removeError = (id: string) =>
    update({ refutedErrors: doctrine.refutedErrors.filter(e => e !== id) });
  const addError = (id: string) => {
    if (!id || doctrine.refutedErrors.includes(id)) return;
    update({ refutedErrors: [...doctrine.refutedErrors, id] });
  };

  const availableHeresies = Object.values(heresyMap).filter(h => !doctrine.refutedErrors.includes(h.id));

  return (
    <div style={{ padding: '40px 60px', maxWidth: 820 }}>
      <button
        type="button"
        onClick={() => onNavigate({ type: 'home' })}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '0.85rem', padding: 0 }}
      >
        <ArrowLeft size={14} />
        {category?.name ?? 'Back'}
      </button>

      <div style={{ marginBottom: 24 }}>
        <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--bg-theo-light)', color: 'var(--accent-theo)', marginBottom: 12 }}>
          {category?.name}
        </span>
        {isEditing ? (
          <input
            value={doctrine.name}
            onChange={e => update({ name: e.target.value })}
            style={editInput({ fontSize: '1.5rem', fontFamily: 'var(--font-serif)', fontWeight: 700, marginBottom: 16, display: 'block' })}
          />
        ) : (
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px', lineHeight: 1.3 }}>
            {doctrine.name}
          </h1>
        )}
        {isEditing ? (
          <textarea
            value={doctrine.description}
            onChange={e => update({ description: e.target.value })}
            rows={6}
            style={editInput({ lineHeight: 1.65, resize: 'vertical' })}
          />
        ) : (
          <p style={{ fontSize: '1rem', lineHeight: 1.75, color: 'var(--text-secondary)', margin: 0 }}>
            {doctrine.description}
          </p>
        )}
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-soft)', margin: '32px 0' }} />

      {/* Scripture */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-serif)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
          <BookOpen size={18} color="var(--accent-exe)" />
          Supporting Scripture
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {doctrine.scriptures.map((s, i) =>
            isEditing ? (
              <div key={i} style={{ padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-soft)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input value={s.reference} onChange={e => updateScripture(i, 'reference', e.target.value)} placeholder="Reference (e.g. John 3:16)" style={editInput({ flex: 1 } as React.CSSProperties)} />
                  <button type="button" onClick={() => removeScripture(i)} title="Remove" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, borderRadius: 6, display: 'flex' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <textarea value={s.text} onChange={e => updateScripture(i, 'text', e.target.value)} placeholder="Verse text" rows={2} style={editInput({ resize: 'vertical' })} />
              </div>
            ) : (() => {
              const parsed = parseScriptureRef(s.reference);
              const to = parsed ? `/reader/${parsed.bookId}/${parsed.chapter}` : undefined;
              return (
                <ReferenceCard
                  key={i}
                  variant="scripture"
                  title={s.reference}
                  excerpt={s.text}
                  to={to}
                />
              );
            })()
          )}
          {isEditing && (
            <button type="button" onClick={addScripture} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, border: '1px dashed var(--accent-exe)', background: 'transparent', cursor: 'pointer', color: 'var(--accent-exe)', fontSize: '0.82rem', fontWeight: 600, alignSelf: 'flex-start' }}>
              <Plus size={13} /> Add Scripture
            </button>
          )}
        </div>
      </section>

      {/* Confessions */}
      {(doctrine.confessions.length > 0 || isEditing) && (
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-serif)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
            <ScrollText size={18} color="var(--accent-geo)" />
            Confessional Support
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {doctrine.confessions.map((c, i) =>
              isEditing ? (
                <div key={i} style={{ padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-soft)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 2 }}>
                      <span style={fieldLabel}>Document</span>
                      <input value={c.document} onChange={e => updateConfession(i, 'document', e.target.value)} style={editInput()} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={fieldLabel}>Section</span>
                      <input value={c.section} onChange={e => updateConfession(i, 'section', e.target.value)} style={editInput()} />
                    </div>
                    <button type="button" onClick={() => removeConfession(i)} title="Remove" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, borderRadius: 6, display: 'flex', alignSelf: 'flex-end', marginBottom: 2 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div>
                    <span style={fieldLabel}>Quote</span>
                    <textarea value={c.quote} onChange={e => updateConfession(i, 'quote', e.target.value)} rows={3} style={editInput({ resize: 'vertical' })} />
                  </div>
                </div>
              ) : (() => {
                const isWcf = c.document.toLowerCase().includes('westminster confession');
                const chapter = isWcf ? parseWcfChapter(c.section) : null;
                const to = isWcf && chapter ? `/archive/wcf/${chapter}` : undefined;
                return (
                  <ReferenceCard
                    key={i}
                    variant="confession"
                    title={c.section}
                    subtitle={c.document}
                    excerpt={c.quote}
                    to={to}
                  />
                );
              })()
            )}
            {isEditing && (
              <button type="button" onClick={addConfession} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, border: '1px dashed var(--accent-geo)', background: 'transparent', cursor: 'pointer', color: 'var(--accent-geo)', fontSize: '0.82rem', fontWeight: 600, alignSelf: 'flex-start' }}>
                <Plus size={13} /> Add Confession
              </button>
            )}
          </div>
        </section>
      )}

      {/* Errors refuted */}
      {(relatedHeresies.length > 0 || isEditing) && (
        <section>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-serif)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
            <AlertTriangle size={18} color="var(--accent-time)" />
            Errors This Doctrine Refutes
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: isEditing ? 12 : 0 }}>
            {doctrine.refutedErrors.map(id => {
              const h = heresyMap[id];
              return isEditing ? (
                <div key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 20, background: 'var(--bg-time-light)', border: '1px solid transparent' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--accent-time)', fontWeight: 600 }}>{h?.name ?? id}</span>
                  <button type="button" onClick={() => removeError(id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--accent-time)', padding: 0, lineHeight: 1, fontSize: '1rem' }}>×</button>
                </div>
              ) : (
                <button key={id} type="button" onClick={() => onNavigate({ type: 'heresy', id })} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-time-light)', border: '1px solid transparent', cursor: 'pointer', textAlign: 'left', gap: 8 }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-time)' }}>{h?.name ?? id}</span>
                  <ChevronRight size={14} color="var(--accent-time)" />
                </button>
              );
            })}
          </div>
          {isEditing && availableHeresies.length > 0 && (
            <select
              defaultValue=""
              onChange={e => { addError(e.target.value); (e.target as HTMLSelectElement).value = ''; }}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-surface)', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              <option value="" disabled>+ Link a heresy…</option>
              {availableHeresies.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          )}
        </section>
      )}
    </div>
  );
}

function HeresyDetail({
  heresy,
  data,
  onNavigate,
  cms,
}: {
  heresy: Heresy;
  data: TheologyData;
  onNavigate: (view: View) => void;
  cms?: TheolayCms;
}) {
  const { doctrineMap } = data;
  const refutingDoctrines = heresy.refutedBy.map(id => doctrineMap[id]).filter(Boolean);
  const isEditing = !!cms?.editMode;

  const update = (patch: Partial<Heresy>) =>
    cms?.onUpdateHeresy({ ...heresy, ...patch });

  const updateProponent = (i: number, val: string) =>
    update({ proponents: heresy.proponents.map((p, idx) => idx === i ? val : p) });
  const removeProponent = (i: number) =>
    update({ proponents: heresy.proponents.filter((_, idx) => idx !== i) });
  const addProponent = () =>
    update({ proponents: [...heresy.proponents, ''] });

  const removeRefutedBy = (id: string) =>
    update({ refutedBy: heresy.refutedBy.filter(d => d !== id) });
  const addRefutedBy = (id: string) => {
    if (!id || heresy.refutedBy.includes(id)) return;
    update({ refutedBy: [...heresy.refutedBy, id] });
  };

  const availableDoctrines = Object.values(doctrineMap).filter(d => !heresy.refutedBy.includes(d.id));

  return (
    <div style={{ padding: '40px 60px', maxWidth: 820 }}>
      <button
        type="button"
        onClick={() => onNavigate({ type: 'home' })}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '0.85rem', padding: 0 }}
      >
        <ArrowLeft size={14} />
        Heresies &amp; Errors
      </button>

      <div style={{ marginBottom: 24 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--bg-time-light)', color: 'var(--accent-time)', marginBottom: 12 }}>
          <AlertTriangle size={11} />
          Historical Error
        </span>
        {isEditing ? (
          <input
            value={heresy.name}
            onChange={e => update({ name: e.target.value })}
            style={editInput({ fontSize: '1.5rem', fontFamily: 'var(--font-serif)', fontWeight: 700, marginBottom: 16, display: 'block' })}
          />
        ) : (
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px', lineHeight: 1.3 }}>
            {heresy.name}
          </h1>
        )}
        {isEditing ? (
          <textarea
            value={heresy.description}
            onChange={e => update({ description: e.target.value })}
            rows={6}
            style={editInput({ lineHeight: 1.65, resize: 'vertical' })}
          />
        ) : (
          <p style={{ fontSize: '1rem', lineHeight: 1.75, color: 'var(--text-secondary)', margin: 0 }}>
            {heresy.description}
          </p>
        )}
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-soft)', margin: '32px 0' }} />

      {/* Proponents */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-serif)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
          <Users size={18} color="var(--accent-time)" />
          Proponents
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {heresy.proponents.map((p, i) =>
            isEditing ? (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input value={p} onChange={e => updateProponent(i, e.target.value)} style={editInput({ flex: 1 } as React.CSSProperties)} />
                <button type="button" onClick={() => removeProponent(i)} title="Remove" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, borderRadius: 6, display: 'flex', flexShrink: 0 }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-subtle)', border: '1px solid var(--border-soft)', fontSize: '0.9rem', color: 'var(--text-secondary)', listStyle: 'none' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-time)', flexShrink: 0 }} />
                {p}
              </li>
            )
          )}
          {isEditing && (
            <button type="button" onClick={addProponent} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, border: '1px dashed var(--accent-time)', background: 'transparent', cursor: 'pointer', color: 'var(--accent-time)', fontSize: '0.82rem', fontWeight: 600, alignSelf: 'flex-start' }}>
              <Plus size={13} /> Add Proponent
            </button>
          )}
        </div>
      </section>

      {/* Doctrines that refute it */}
      {(refutingDoctrines.length > 0 || isEditing) && (
        <section>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-serif)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
            <Scale size={18} color="var(--accent-theo)" />
            Doctrines That Refute This Error
          </h2>
          <div style={{ display: 'flex', flexWrap: isEditing ? 'wrap' : 'nowrap', flexDirection: isEditing ? 'row' : 'column', gap: 8, marginBottom: isEditing ? 12 : 0 }}>
            {heresy.refutedBy.map(id => {
              const d = doctrineMap[id];
              return isEditing ? (
                <div key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 20, background: 'var(--bg-theo-light)', border: '1px solid transparent' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--accent-theo)', fontWeight: 600 }}>{d?.name ?? id}</span>
                  <button type="button" onClick={() => removeRefutedBy(id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--accent-theo)', padding: 0, lineHeight: 1, fontSize: '1rem' }}>×</button>
                </div>
              ) : (
                d ? (
                  <button key={id} type="button" onClick={() => onNavigate({ type: 'doctrine', id })} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-theo-light)', border: '1px solid transparent', cursor: 'pointer', textAlign: 'left' }}>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-theo)' }}>{d.name}</div>
                    </div>
                    <ChevronRight size={14} color="var(--accent-theo)" />
                  </button>
                ) : null
              );
            })}
          </div>
          {isEditing && availableDoctrines.length > 0 && (
            <select
              defaultValue=""
              onChange={e => { addRefutedBy(e.target.value); (e.target as HTMLSelectElement).value = ''; }}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-surface)', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              <option value="" disabled>+ Link a doctrine…</option>
              {availableDoctrines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
        </section>
      )}
    </div>
  );
}

function HomeView({ data, onNavigate }: { data: TheologyData; onNavigate: (view: View) => void }) {
  return (
    <div style={{ padding: '40px 60px', maxWidth: 820 }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>
        Theology Explorer
      </h1>
      <p style={{ fontSize: '1rem', lineHeight: 1.75, color: 'var(--text-secondary)', marginBottom: 40 }}>
        Explore systematic theology from a Reformed perspective. Browse doctrines by category, see their scriptural and confessional foundations, and understand the historical errors they correct.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 40 }}>
        {data.categories.map(cat => (
          <button
            key={cat.id}
            type="button"
            onClick={() => {
              const firstId = cat.doctrines[0];
              if (firstId) onNavigate({ type: 'doctrine', id: firstId });
            }}
            style={{ padding: 20, borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-card)', cursor: 'pointer', textAlign: 'left' }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: 4 }}>{cat.name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{cat.doctrines.length} {cat.doctrines.length === 1 ? 'doctrine' : 'doctrines'}</div>
          </button>
        ))}
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-soft)', margin: '0 0 32px' }} />

      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertTriangle size={18} color="var(--accent-time)" />
        Heresies &amp; Historical Errors
      </h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {data.heresies.map(h => (
          <button
            key={h.id}
            type="button"
            onClick={() => onNavigate({ type: 'heresy', id: h.id })}
            style={{ padding: '6px 14px', borderRadius: 20, background: 'var(--bg-time-light)', border: '1px solid transparent', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-time)' }}
          >
            {h.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function TheologyExplorer() {
  const { id: paramId } = useParams<{ id?: string }>();
  const location = useLocation();
  const routerNavigate = useNavigate();

  // Derive view from URL path
  const urlView = useMemo<View>(() => {
    if (location.pathname.includes('/doctrine/') && paramId) return { type: 'doctrine', id: paramId };
    if (location.pathname.includes('/heresy/') && paramId) return { type: 'heresy', id: paramId };
    return { type: 'home' };
  }, [location.pathname, paramId]);

  const [view, setView] = useState<View>(urlView);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => new Set());
  const [doctrines, setDoctrines] = useState<Doctrine[]>(DEFAULT_DOCTRINES);
  const [heresies, setHeresies] = useState<Heresy[]>(DEFAULT_HERESIES);

  const isCmsMode = import.meta.env.VITE_CMS_MODE === 'true';
  const [cmsEditMode, setCmsEditMode] = useState(false);
  const [cmsSaving, setCmsSaving] = useState(false);
  const [cmsSaveMsg, setCmsSaveMsg] = useState('');

  const doctrineMap = useMemo(() => Object.fromEntries(doctrines.map(d => [d.id, d])), [doctrines]);
  const heresyMap = useMemo(() => Object.fromEntries(heresies.map(h => [h.id, h])), [heresies]);
  const categoryMap = useMemo(() => Object.fromEntries(CATEGORIES.map(c => [c.id, c])), []);

  const data: TheologyData = { categories: CATEGORIES, doctrines, heresies, doctrineMap, heresyMap, categoryMap };

  // Sync URL → internal view when the URL changes (e.g. back/forward or ReferenceCard link)
  useEffect(() => {
    setView(urlView);
    if (urlView.type === 'doctrine') {
      const doc = doctrineMap[urlView.id];
      if (doc) setExpandedCategories(prev => new Set([...prev, doc.categoryId]));
    }
  }, [urlView.type, urlView.type === 'home' ? '' : urlView.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isCmsMode) return;
    (async () => {
      try {
        const res = await fetch('http://localhost:4001/file/theology/data.json');
        if (!res.ok) return;
        const json = await res.json();
        if (Array.isArray(json.doctrines)) setDoctrines(json.doctrines);
        if (Array.isArray(json.heresies)) setHeresies(json.heresies);
      } catch {
        // fall back to defaults
      }
    })();
  }, [isCmsMode]);

  const updateDoctrine = (updated: Doctrine) =>
    setDoctrines(prev => prev.map(d => d.id === updated.id ? updated : d));

  const updateHeresy = (updated: Heresy) =>
    setHeresies(prev => prev.map(h => h.id === updated.id ? updated : h));

  const saveToDisk = async () => {
    setCmsSaving(true);
    setCmsSaveMsg('');
    try {
      const res = await fetch('http://localhost:4001/file/theology/data.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: JSON.stringify({ doctrines, heresies }, null, 2) })
      });
      if (!res.ok) throw new Error('PUT failed');
      setCmsSaveMsg('Saved!');
      setTimeout(() => setCmsSaveMsg(''), 2500);
    } catch {
      setCmsSaveMsg('Save failed');
    } finally {
      setCmsSaving(false);
    }
  };

  const cms: TheolayCms = { editMode: cmsEditMode, onUpdateDoctrine: updateDoctrine, onUpdateHeresy: updateHeresy };

  function navigate(next: View) {
    setView(next);
    if (next.type === 'doctrine') {
      const doc = doctrineMap[next.id];
      if (doc) setExpandedCategories(prev => new Set([...prev, doc.categoryId]));
      routerNavigate(`/theology/doctrine/${next.id}`);
    } else if (next.type === 'heresy') {
      routerNavigate(`/theology/heresy/${next.id}`);
    } else {
      routerNavigate('/theology');
    }
  }

  const activeHeresyId = view.type === 'heresy' ? view.id : null;

  return (
    <div className="workspace" style={{ display: 'flex', overflow: 'hidden' }}>
      {/* ── Sidebar ── */}
      <aside className="left-sidebar" style={{ width: 280, flexShrink: 0 }}>
        <div style={{ padding: '20px 20px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Scale size={16} color="var(--accent-theo)" />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-theo)' }}>
              Systematic Theology
            </span>
          </div>
        </div>

        {CATEGORIES.map(cat => {
          const isOpen = expandedCategories.has(cat.id);
          return (
            <div key={cat.id}>
              <button
                type="button"
                onClick={() => {
                  setExpandedCategories(prev => {
                    const next = new Set(prev);
                    if (next.has(cat.id)) next.delete(cat.id);
                    else next.add(cat.id);
                    return next;
                  });
                }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)', gap: 6 }}
              >
                <span>{cat.name}</span>
                {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>

              {isOpen && (
                <div style={{ paddingLeft: 8 }}>
                  {cat.doctrines.map(id => {
                    const doc = doctrineMap[id];
                    if (!doc) return null;
                    const active = view.type === 'doctrine' && view.id === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => navigate({ type: 'doctrine', id })}
                        style={{ width: '100%', display: 'block', padding: '6px 16px', background: active ? 'var(--bg-theo-light)' : 'transparent', border: 'none', borderLeft: active ? '2px solid var(--accent-theo)' : '2px solid transparent', cursor: 'pointer', textAlign: 'left', fontSize: '0.83rem', fontWeight: active ? 600 : 400, color: active ? 'var(--accent-theo)' : 'var(--text-secondary)', borderRadius: '0 6px 6px 0' }}
                      >
                        {doc.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div style={{ margin: '16px 20px', borderTop: '1px solid var(--border-soft)' }} />

        <div style={{ padding: '4px 20px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={14} color="var(--accent-time)" />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-time)' }}>
              Heresies &amp; Errors
            </span>
          </div>
        </div>

        {heresies.map(h => {
          const active = activeHeresyId === h.id;
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => navigate({ type: 'heresy', id: h.id })}
              style={{ width: '100%', display: 'block', padding: '7px 20px', background: active ? 'var(--bg-time-light)' : 'transparent', border: 'none', borderLeft: active ? '2px solid var(--accent-time)' : '2px solid transparent', cursor: 'pointer', textAlign: 'left', fontSize: '0.83rem', fontWeight: active ? 600 : 400, color: active ? 'var(--accent-time)' : 'var(--text-secondary)' }}
            >
              {h.name}
            </button>
          );
        })}

        <div style={{ height: 24 }} />
      </aside>

      {/* ── Main Content ── */}
      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-page)' }}>
        {view.type === 'home' && <HomeView data={data} onNavigate={navigate} />}
        {view.type === 'doctrine' && doctrineMap[view.id] && (
          <DoctrineDetail doctrine={doctrineMap[view.id]} data={data} onNavigate={navigate} cms={isCmsMode ? cms : undefined} />
        )}
        {view.type === 'heresy' && heresyMap[view.id] && (
          <HeresyDetail heresy={heresyMap[view.id]} data={data} onNavigate={navigate} cms={isCmsMode ? cms : undefined} />
        )}
      </main>

      {/* CMS floating toolbar */}
      {isCmsMode && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-soft)',
          borderRadius: 24, padding: '8px 14px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.14)',
        }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>CMS</span>
          <button
            type="button"
            onClick={() => setCmsEditMode(m => !m)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 16, border: 'none', cursor: 'pointer',
              background: cmsEditMode ? 'var(--accent-theo)' : 'var(--bg-sidebar)',
              color: cmsEditMode ? 'white' : 'var(--text-secondary)',
              fontWeight: 600, fontSize: '0.82rem',
            }}
          >
            <Pencil size={12} /> {cmsEditMode ? 'Editing' : 'Edit'}
          </button>
          {cmsEditMode && (view.type === 'doctrine' || view.type === 'heresy') && (
            <>
              {cmsSaveMsg && (
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: cmsSaveMsg === 'Saved!' ? 'green' : 'var(--accent-exe)' }}>
                  {cmsSaveMsg}
                </span>
              )}
              <button
                type="button"
                onClick={saveToDisk}
                disabled={cmsSaving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 16, border: 'none', cursor: cmsSaving ? 'default' : 'pointer',
                  background: 'var(--accent-exe)', color: 'white',
                  fontWeight: 600, fontSize: '0.82rem', opacity: cmsSaving ? 0.7 : 1,
                }}
              >
                <Save size={12} /> {cmsSaving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
