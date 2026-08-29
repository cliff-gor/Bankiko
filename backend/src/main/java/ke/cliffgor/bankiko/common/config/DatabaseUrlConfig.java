package ke.cliffgor.bankiko.common.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;

/**
 * Converts Render/Heroku-style DATABASE_URL and REDIS_URL into Spring properties.
 * DATABASE_URL: postgres://user:pass@host:port/db → jdbc:postgresql://...
 * REDIS_URL: redis://:pass@host:port → spring.data.redis.*
 */
public class DatabaseUrlConfig implements EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        Map<String, Object> props = new HashMap<>();

        String databaseUrl = environment.getProperty("DATABASE_URL");
        if (databaseUrl != null && !databaseUrl.isBlank()) {
            try {
                URI uri = URI.create(databaseUrl.replace("postgres://", "postgresql://"));
                String host = uri.getHost();
                int port = uri.getPort() == -1 ? 5432 : uri.getPort();
                String db = uri.getPath().replaceFirst("/", "");
                String[] userInfo = uri.getUserInfo() != null ? uri.getUserInfo().split(":") : new String[]{"", ""};
                String user = userInfo[0];
                String password = userInfo.length > 1 ? userInfo[1] : "";

                props.put("spring.datasource.url",
                        "jdbc:postgresql://" + host + ":" + port + "/" + db + "?sslmode=require");
                props.put("spring.datasource.username", user);
                props.put("spring.datasource.password", password);
            } catch (Exception ignored) {}
        }

        String redisUrl = environment.getProperty("REDIS_URL");
        if (redisUrl != null && !redisUrl.isBlank()) {
            try {
                URI uri = URI.create(redisUrl);
                String host = uri.getHost();
                int port = uri.getPort() == -1 ? 6379 : uri.getPort();
                String password = uri.getUserInfo() != null
                        ? uri.getUserInfo().replaceFirst(".*:", "")
                        : "";

                props.put("spring.data.redis.host", host);
                props.put("spring.data.redis.port", String.valueOf(port));
                if (!password.isBlank()) {
                    props.put("spring.data.redis.password", password);
                }
            } catch (Exception ignored) {}
        }

        if (!props.isEmpty()) {
            environment.getPropertySources().addFirst(new MapPropertySource("renderUrlVars", props));
        }
    }
}
