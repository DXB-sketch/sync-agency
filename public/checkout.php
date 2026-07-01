<?php
/**
 * Deploy this file to your SiteGround public_html root alongside the built React app.
 * Run: composer require stripe/stripe-php in that same directory.
 */

$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['priceId']) || !isset($input['mode'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields']);
    exit;
}

$priceId  = $input['priceId'];
$mode     = $input['mode'];
$tierName = isset($input['tierName']) ? $input['tierName'] : '';

// Affiliate code captured from a ?aff= visit. Re-sanitize to the chars Stripe's
// client_reference_id accepts (alphanumeric, dash, underscore; max 200).
$affiliate = '';
if (isset($input['affiliate']) && is_string($input['affiliate'])) {
    $affiliate = substr(preg_replace('/[^A-Za-z0-9_-]/', '', $input['affiliate']), 0, 200);
}

require_once __DIR__ . '/vendor/autoload.php';

$secretKey = getenv('STRIPE_SECRET_KEY');
if (!$secretKey) {
    http_response_code(500);
    echo json_encode(['error' => 'Stripe secret key not configured']);
    exit;
}

\Stripe\Stripe::setApiKey($secretKey);

$requestOrigin = $origin ?: (isset($_SERVER['HTTP_HOST']) ? 'https://' . $_SERVER['HTTP_HOST'] : '');

try {
    $params = [
        'line_items' => [[
            'price'    => $priceId,
            'quantity' => 1,
        ]],
        'mode'        => $mode,
        'success_url' => $requestOrigin . '/?checkout=success&tier=' . urlencode($tierName),
        'cancel_url'  => $requestOrigin . '/#pricing',
    ];

    if ($affiliate !== '') {
        $params['client_reference_id'] = $affiliate;
    }

    if ($mode === 'subscription') {
        $params['allow_promotion_codes'] = true;
        $params['subscription_data']     = ['trial_period_days' => 3];
    }

    $session = \Stripe\Checkout\Session::create($params);

    echo json_encode(['url' => $session->url]);
} catch (\Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
