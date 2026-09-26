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

        // Auto grant audio & video capture permissions to WebView if Android OS permissions are granted
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    runOnUiThread(() -> {
                        String[] resources = request.getResources();
                        boolean needRecordAudio = false;
                        boolean needCamera = false;

                        for (String r : resources) {
                            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) {
                                needRecordAudio = true;
                            }
                            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) {
                                needCamera = true;
                            }
                        }

                        List<String> permissionsToRequest = new ArrayList<>();
                        if (needRecordAudio && ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                            permissionsToRequest.add(Manifest.permission.RECORD_AUDIO);
                        }
                        if (needCamera && ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                            permissionsToRequest.add(Manifest.permission.CAMERA);
                        }

                        if (!permissionsToRequest.isEmpty()) {
                            pendingWebPermissionRequest = request;
                            ActivityCompat.requestPermissions(
                                MainActivity.this,
                                permissionsToRequest.toArray(new String[0]),
                                PERMISSION_REQUEST_CODE
                            );
                        } else {
                            try {
                                request.grant(resources);
                            } catch (Exception e) {
                                e.printStackTrace();
                            }
                        }
                    });
                }
            });
        }

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
                    boolean allGranted = true;
                    for (int result : grantResults) {
                        if (result != PackageManager.PERMISSION_GRANTED) {
                            allGranted = false;
                            break;
                        }
                    }
                    try {
                        if (allGranted) {
                            req.grant(req.getResources());
                        } else {
                            req.deny();
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                });
            }
        }
    }
}
