import { NextResponse } from "next/server";
import crypto from "crypto";

const META_API_VERSION = "v21.0";
const META_GRAPH_URL = `https://graph.facebook.com/${META_API_VERSION}`;

function generateAppSecretProof(accessToken: string, appSecret: string): string {
  return crypto
    .createHmac("sha256", appSecret)
    .update(accessToken)
    .digest("hex");
}

export async function GET() {
  try {
    const appSecret = process.env.META_APP_SECRET;
    const accessToken = process.env.META_ACCESS_TOKEN;
    const rawAdAccountId = process.env.META_AD_ACCOUNT_ID;
    
    const adAccountId = rawAdAccountId?.startsWith("act_") 
      ? rawAdAccountId 
      : `act_${rawAdAccountId}`;

    if (!appSecret || !accessToken || !rawAdAccountId) {
      return NextResponse.json({
        error: "Meta API credentials not configured",
        hasAppSecret: !!appSecret,
        hasAccessToken: !!accessToken,
        hasAdAccountId: !!rawAdAccountId,
      });
    }
    
    const appSecretProof = generateAppSecretProof(accessToken, appSecret);
    
    const debugInfo: Record<string, unknown> = {
      adAccountId,
      tokenInfo: null,
      tokenPermissions: null,
      adAccountInfo: null,
      errors: [] as string[],
    };
    
    // 1. Debug token info
    try {
      const tokenUrl = new URL(`${META_GRAPH_URL}/debug_token`);
      tokenUrl.searchParams.set("input_token", accessToken);
      tokenUrl.searchParams.set("access_token", accessToken);
      tokenUrl.searchParams.set("appsecret_proof", appSecretProof);
      
      const tokenResponse = await fetch(tokenUrl.toString());
      const tokenData = await tokenResponse.json();
      debugInfo.tokenInfo = tokenData;
    } catch (e) {
      (debugInfo.errors as string[]).push(`Token debug failed: ${e}`);
    }
    
    // 2. Get token permissions
    try {
      const permUrl = new URL(`${META_GRAPH_URL}/me/permissions`);
      permUrl.searchParams.set("access_token", accessToken);
      permUrl.searchParams.set("appsecret_proof", appSecretProof);
      
      const permResponse = await fetch(permUrl.toString());
      const permData = await permResponse.json();
      debugInfo.tokenPermissions = permData;
    } catch (e) {
      (debugInfo.errors as string[]).push(`Permissions check failed: ${e}`);
    }
    
    // 3. Check ad account access
    try {
      const accountUrl = new URL(`${META_GRAPH_URL}/${adAccountId}`);
      accountUrl.searchParams.set("access_token", accessToken);
      accountUrl.searchParams.set("appsecret_proof", appSecretProof);
      accountUrl.searchParams.set("fields", "id,name,account_status,capabilities,disable_reason,funding_source_details");
      
      const accountResponse = await fetch(accountUrl.toString());
      const accountData = await accountResponse.json();
      debugInfo.adAccountInfo = accountData;
    } catch (e) {
      (debugInfo.errors as string[]).push(`Ad account check failed: ${e}`);
    }
    
    // 4. Try a simple read operation on the ad account
    try {
      const adsUrl = new URL(`${META_GRAPH_URL}/${adAccountId}/ads`);
      adsUrl.searchParams.set("access_token", accessToken);
      adsUrl.searchParams.set("appsecret_proof", appSecretProof);
      adsUrl.searchParams.set("limit", "1");
      adsUrl.searchParams.set("fields", "id,name");
      
      const adsResponse = await fetch(adsUrl.toString());
      const adsData = await adsResponse.json();
      debugInfo.canReadAds = !adsData.error;
      debugInfo.readAdsResponse = adsData.error || `Found ${adsData.data?.length || 0} ads`;
    } catch (e) {
      (debugInfo.errors as string[]).push(`Ads read check failed: ${e}`);
    }
    
    // 5. Check if we can access adimages (read only)
    try {
      const imagesUrl = new URL(`${META_GRAPH_URL}/${adAccountId}/adimages`);
      imagesUrl.searchParams.set("access_token", accessToken);
      imagesUrl.searchParams.set("appsecret_proof", appSecretProof);
      imagesUrl.searchParams.set("limit", "1");
      imagesUrl.searchParams.set("fields", "hash,url");
      
      const imagesResponse = await fetch(imagesUrl.toString());
      const imagesData = await imagesResponse.json();
      debugInfo.canReadImages = !imagesData.error;
      debugInfo.readImagesResponse = imagesData.error || `Found ${imagesData.data?.length || 0} images`;
      
      // If we found images, get the first hash for testing
      if (imagesData.data && imagesData.data.length > 0) {
        debugInfo.existingImageHash = imagesData.data[0].hash;
      }
    } catch (e) {
      (debugInfo.errors as string[]).push(`Images read check failed: ${e}`);
    }
    
    return NextResponse.json(debugInfo, { status: 200 });
  } catch (error) {
    console.error("[Meta Debug] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Debug failed" },
      { status: 500 }
    );
  }
}
