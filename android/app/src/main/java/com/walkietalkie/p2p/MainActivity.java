package com.walkietalkie.p2p;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQUEST_CODE = 1234;
    private PermissionRequest pendingWebPermissionRequest;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Ensure Android WebView delegates camera & microphone permissions directly to Android OS Native prompt
        this.bridge.getWebView().setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    List<String> neededPermissions = new ArrayList<>();
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                            if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                                neededPermissions.add(Manifest.permission.RECORD_AUDIO);
                            }
                        }
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                            if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                                neededPermissions.add(Manifest.permission.CAMERA);
                            }
                        }
                    }

                    if (!neededPermissions.isEmpty()) {
                        pendingWebPermissionRequest = request;
                        ActivityCompat.requestPermissions(
                            MainActivity.this,
                            neededPermissions.toArray(new String[0]),
                            PERMISSION_REQUEST_CODE
                        );
                    } else {
                        request.grant(request.getResources());
                    }
                });
            }
        });

        requestNativePermissionsOnStartup();
    }

    private void requestNativePermissionsOnStartup() {
        List<String> permissions = new ArrayList<>();
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.RECORD_AUDIO);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.CAMERA);
        }
        if (!permissions.isEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                permissions.toArray(new String[0]),
                PERMISSION_REQUEST_CODE
            );
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            if (pendingWebPermissionRequest != null) {
                final PermissionRequest req = pendingWebPermissionRequest;
                pendingWebPermissionRequest = null;
                runOnUiThread(() -> {
                    try {
                        req.grant(req.getResources());
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                });
            }
        }
    }
}
